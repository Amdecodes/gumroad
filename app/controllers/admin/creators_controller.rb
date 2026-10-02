# frozen_string_literal: true

class Admin::CreatorsController < Admin::BaseController
  include Pagy::Backend
  include CurrencyHelper

  layout "inertia"

  CREATORS_PER_PAGE = 25

  before_action :fetch_creator, only: [:show, :suspend, :unsuspend]

  def index
    query_str = params[:q].to_s.strip
    status_filter = params[:status].to_s.strip.presence

    relation = User.all.order(id: :desc)

    if status_filter.present?
      case status_filter
      when "active"
        relation = relation.alive.not_suspended
      when "suspended"
        relation = relation.where(user_risk_state: %w[suspended_for_fraud suspended_for_tos_violation])
      when "deleted"
        relation = relation.deleted
      end
    else
      relation = relation.alive
    end

    if query_str.present?
      sanitized = ActiveRecord::Base.sanitize_sql_like(query_str.delete_prefix("@"))
      pattern = "%#{sanitized}%"
      relation = relation.where(
        "users.email LIKE :pattern OR users.username LIKE :pattern OR users.name LIKE :pattern",
        pattern:
      )
    end

    @pagy, @creators = pagy(relation, limit: CREATORS_PER_PAGE)

    creator_ids = @creators.map(&:id)
    product_counts = Link.alive.where(user_id: creator_ids).group(:user_id).count
    sales_aggregates = Purchase.paid.where(seller_id: creator_ids).group(:seller_id).pluck(
      :seller_id,
      Arel.sql("COUNT(*)"),
      Arel.sql("COALESCE(SUM(purchases.price_cents), 0)")
    ).to_h { |id, count, sum_cents| [id, { count: count.to_i, volume_cents: sum_cents.to_i }] }

    creators_props = @creators.map do |creator|
      {
        external_id: creator.external_id,
        username: creator.username,
        display_name: creator.name.presence || creator.username.presence || creator.email,
        email: creator.email,
        avatar_url: creator.avatar_url,
        product_count: product_counts[creator.id] || 0,
        total_sales_count: sales_aggregates[creator.id]&.fetch(:count, 0) || 0,
        formatted_lifetime_volume: formatted_dollar_amount(sales_aggregates[creator.id]&.fetch(:volume_cents, 0) || 0),
        status: creator_status(creator),
        joined_at: creator.created_at.as_json
      }
    end

    render inertia: "Admin/Creators/Index", props: {
      creators: creators_props,
      pagy: {
        page: @pagy.page,
        pages: @pagy.pages,
        count: @pagy.count,
        next_page: @pagy.next,
        prev_page: @pagy.prev,
        has_more: @pagy.next.present?
      },
      filters: {
        q: query_str.presence,
        status: status_filter.presence
      },
      current_admin: current_admin_props
    }
  end

  def show
    revenue_cents = @creator.sales.paid.sum(:price_cents)

    render inertia: "Admin/Creators/Show", props: {
      profile: {
        external_id: @creator.external_id,
        username: @creator.username,
        display_name: @creator.name.presence || @creator.username.presence || @creator.email,
        email: @creator.email,
        avatar_url: @creator.avatar_url,
        bio: @creator.bio,
        joined_at: @creator.created_at.as_json,
        status: creator_status(@creator),
        verified_status: @creator.verified?
      },
      metrics: {
        lifetime_revenue_cents: revenue_cents,
        formatted_lifetime_revenue: formatted_dollar_amount(revenue_cents),
        sales_count: @creator.sales.paid.count,
        active_products_count: @creator.products.alive.not_archived.count,
        customer_count: @creator.sales.paid.distinct.count(:email)
      },
      products: @creator.products.alive.order(id: :desc).limit(5).map do |product|
        {
          id: product.external_id,
          title: product.name,
          price_formatted: formatted_dollar_amount(product.price_cents),
          sales_count: product.sales.paid.count,
          status: product.published? ? "published" : "draft",
          published_date: product.created_at.as_json
        }
      end,
      payment_info: {
        payout_setup: @creator.has_valid_payout_info?,
        payouts_paused: @creator.payouts_paused?,
        payouts_paused_reason: @creator.payouts_paused_for_reason,
        payment_address: @creator.payment_address,
        paypal_email: @creator.paypal_payout_email,
        verified: @creator.verified?
      },
      impersonate_url: "/admin/impersonate?user_id=#{@creator.external_id}",
      audit_history: recent_audit_history(@creator),
      current_admin: current_admin_props
    }
  end

  def suspend
    reason = params[:reason].to_s.strip
    if reason.blank?
      error_message = "Reason is required"
      if request.inertia? || request.format.html?
        redirect_to admin_creator_path(@creator.external_id), alert: error_message
      else
        render json: { success: false, message: error_message }, status: :bad_request
      end
      return
    end

    endpoint = params[:reason_type] == "fraud" ? "/internal/admin/users/suspend_for_fraud" : "/internal/admin/users/suspend_for_tos_violation"
    result = Admin::InternalApiCaller.call(
      admin_user: current_user,
      method: :post,
      path: endpoint,
      params: {
        user_id: @creator.external_id,
        suspension_note: reason
      }
    )

    if result.success?
      message = result.data&.fetch("message", "Creator suspended successfully")
      if request.inertia? || request.format.html?
        redirect_to admin_creator_path(@creator.external_id), notice: message
      else
        render json: result.data, status: result.status
      end
    else
      error_message = result.error_message
      if request.inertia? || request.format.html?
        redirect_to admin_creator_path(@creator.external_id), alert: error_message
      else
        render json: result.data, status: result.status
      end
    end
  end

  def unsuspend
    reason = params[:reason].to_s.strip
    if reason.blank?
      error_message = "Reason is required"
      if request.inertia? || request.format.html?
        redirect_to admin_creator_path(@creator.external_id), alert: error_message
      else
        render json: { success: false, message: error_message }, status: :bad_request
      end
      return
    end

    result = Admin::InternalApiCaller.call(
      admin_user: current_user,
      method: :post,
      path: "/internal/admin/users/mark_compliant",
      params: {
        user_id: @creator.external_id,
        note: reason,
        clear_suspension: "true"
      }
    )

    if result.success?
      message = result.data&.fetch("message", "Creator unsuspended successfully")
      if request.inertia? || request.format.html?
        redirect_to admin_creator_path(@creator.external_id), notice: message
      else
        render json: result.data, status: result.status
      end
    else
      error_message = result.error_message
      if request.inertia? || request.format.html?
        redirect_to admin_creator_path(@creator.external_id), alert: error_message
      else
        render json: result.data, status: result.status
      end
    end
  end

  private
    def fetch_creator
      identifier = params[:id].to_s.strip
      @creator = User.find_by(external_id: identifier) || User.find_by(username: identifier)
      return if @creator.present?

      if request.inertia? || request.format.html?
        render file: Rails.public_path.join("404.html"), status: :not_found, layout: false
      else
        render json: { success: false, message: "Creator not found" }, status: :not_found
      end
    end

    def creator_status(user)
      if user.deleted?
        "deleted"
      elsif user.suspended?
        "suspended"
      else
        "active"
      end
    end

    def recent_audit_history(user)
      AdminApiAuditLog
        .where(target_type: "User", target_id: user.id)
        .or(AdminApiAuditLog.where(target_external_id: user.external_id))
        .order(id: :desc)
        .limit(10)
        .includes(:actor_user)
        .map do |log|
          {
            id: log.id.to_s,
            action: log.action,
            actor_name: log.actor_user&.name.presence || log.actor_user&.email || "System",
            created_at: log.created_at.as_json,
            response_status: log.response_status
          }
        end
    end

    def current_admin_props
      {
        name: current_user.name.presence || current_user.email,
        email: current_user.email,
        avatar_url: current_user.avatar_url
      }
    end
end
