# frozen_string_literal: true

require "ipaddr"

class Admin::BaseController < ApplicationController
  include Impersonate

  layout "admin"

  inertia_share do
    {
      current_admin: -> { current_admin_props }
    }
  end

  around_action :log_admin_request
  before_action :check_admin_ip_allowlist!
  before_action :require_admin!
  before_action :require_admin_two_factor!

  def impersonate
    user = find_user(params[:user_identifier].presence || params[:user_id])

    if user
      impersonate_user(user)
      log_admin_audit(event: "impersonate_start", target: user)
      redirect_to products_path
    else
      log_admin_audit(event: "impersonate_failed_not_found", target: params[:user_identifier].presence || params[:user_id])
      flash[:alert] = t("admin.user_not_found", default: "User not found")
      redirect_to root_path
    end
  end

  def unimpersonate
    target_user = impersonated_user
    stop_impersonating_user
    log_admin_audit(event: "impersonate_stop", target: target_user)

    respond_to do |format|
      format.json { render json: { redirect_to: root_url } }
      format.html { redirect_to root_url, notice: "Stopped impersonating #{target_user&.email || 'user'}." }
    end
  end

  def redirect_to_stripe_dashboard
    user = find_user(params[:user_identifier])

    if user
      merchant_account = user.merchant_accounts.alive.stripe.first

      if merchant_account&.charge_processor_merchant_id
        base_url = "https://dashboard.stripe.com"
        base_url += "/test" unless Rails.env.production?
        redirect_to "#{base_url}/connect/accounts/#{merchant_account.charge_processor_merchant_id}", allow_other_host: true
      else
        flash[:alert] = t("admin.stripe_account_not_found", default: "Stripe account not found")
        redirect_to root_path
      end
    else
      flash[:alert] = t("admin.user_not_found", default: "User not found")
      redirect_to root_path
    end
  end

  private
    def find_user(identifier)
      return nil if identifier.blank?

      User.find_by(external_id: identifier) ||
      User.find_by(email: identifier) ||
      User.find_by(username: identifier) ||
      (User.find_by(id: identifier) if /^\d+$/.match?(identifier.to_s)) ||
      MerchantAccount.stripe.find_by(charge_processor_merchant_id: identifier)&.user
    end

    def check_admin_ip_allowlist!
      raw_allowed = ENV["ADMIN_ALLOWED_IPS"].to_s.strip
      return if raw_allowed.blank?

      allowed_ranges = raw_allowed.split(",").map(&:strip).reject(&:blank?)
      return if allowed_ranges.empty?

      client_ip = IPAddr.new(request.remote_ip) rescue nil
      is_allowed = client_ip.present? && allowed_ranges.any? do |range|
        IPAddr.new(range).include?(client_ip)
      rescue IPAddr::InvalidAddressError
        false
      end

      unless is_allowed
        log_admin_audit(event: "admin_ip_blocked", remote_ip: request.remote_ip)
        if xhr_or_json_request?
          render json: { error: "Forbidden: IP not allowed" }, status: :forbidden
        else
          render plain: "Forbidden: IP not allowed", status: :forbidden
        end
      end
    end

    def require_admin!
      if current_user.nil?
        return e404_json if xhr_or_json_request?
        return redirect_to login_path(next: request.path)
      end

      unless current_user.is_team_member?
        return e404_json if xhr_or_json_request?
        redirect_to root_path
      end
    end

    def require_admin_two_factor!
      return unless admin_two_factor_required?
      return if current_user&.two_factor_authentication_enabled?

      log_admin_audit(event: "admin_2fa_blocked", error: "Missing two-factor authentication")

      if xhr_or_json_request?
        render json: { error: "Two-factor authentication is required for staff access." }, status: :forbidden
      else
        redirect_to settings_password_path, alert: "Two-factor authentication is required for staff access."
      end
    end

    def admin_two_factor_required?
      Rails.env.production? || ActiveModel::Type::Boolean.new.cast(ENV["ADMIN_REQUIRE_2FA"])
    end

    def log_admin_request
      start_time = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      yield
    ensure
      duration_ms = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start_time) * 1000).round(2) rescue nil
      target_id = params[:id] || params[:user_identifier] || params[:user_id]
      payload = {
        event: "admin_request",
        actor: current_user ? { id: current_user.id, email: current_user.email } : nil,
        target: target_id.to_s.presence,
        controller: controller_name,
        action: action_name,
        route: request.fullpath,
        http_method: request.method,
        status: response&.status,
        remote_ip: request.remote_ip,
        duration_ms:,
        timestamp: Time.current.iso8601
      }
      Rails.logger.info("[ADMIN_AUDIT] #{payload.to_json}")
    end

    def log_admin_audit(event:, target: nil, **extra)
      target_payload = if target.is_a?(User)
        { id: target.id, email: target.email, external_id: target.external_id }
      else
        target.presence
      end

      payload = {
        event:,
        actor: current_user ? { id: current_user.id, email: current_user.email } : nil,
        target: target_payload,
        route: request.fullpath,
        http_method: request.method,
        remote_ip: request.remote_ip,
        timestamp: Time.current.iso8601
      }.merge(extra)
      Rails.logger.info("[ADMIN_AUDIT] #{payload.to_json}")
    end

    def xhr_or_json_request?
      request.xhr? || request.format.json?
    end

    def current_admin_props
      return nil unless current_user

      {
        name: current_user.name.presence || current_user.email,
        email: current_user.email,
        avatar_url: current_user.avatar_url
      }
    end
end
