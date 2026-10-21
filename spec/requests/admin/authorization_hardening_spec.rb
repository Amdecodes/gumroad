# frozen_string_literal: true

require "spec_helper"

describe "Admin Authorization Hardening", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:seller) { create(:user, email: "normal_seller@example.com", is_team_member: false) }
  let(:buyer) { create(:user, email: "buyer@example.com", is_team_member: false) }
  let(:authorized_admin) do
    user = create(:admin_user, email: "staff@example.com", is_team_member: true)
    user.update_column(:flags, user.flags | User.flag_mapping["flags"][:two_factor_authentication_enabled])
    user
  end
  let(:staff_without_2fa) do
    user = create(:user, email: "staff_no2fa@example.com", is_team_member: true, skip_enabling_two_factor_authentication: true)
    user.update_column(:flags, user.flags & ~User.flag_mapping["flags"][:two_factor_authentication_enabled])
    user
  end

  around do |example|
    ActionController::Base.allow_forgery_protection = false
    example.run
  ensure
    ActionController::Base.allow_forgery_protection = true
  end

  before do
    host! DOMAIN
    Rails.application.reload_routes!
  end

  CONTROLLER_ROUTES = [
    { method: :get, path: "/admin" },
    { method: :get, path: "/admin/impersonate" },
    { method: :delete, path: "/admin/unimpersonate" },
    { method: :get, path: "/admin/redirect_to_stripe_dashboard" },
    { method: :post, path: "/admin/orders/1/resend_receipt" },
    { method: :post, path: "/admin/orders/1/refund" },
    { method: :post, path: "/admin/orders/1/cancel_subscription" },
    { method: :post, path: "/admin/orders/1/reverify" },
    { method: :get, path: "/admin/orders" },
    { method: :get, path: "/admin/orders/1" },
    { method: :post, path: "/admin/creators/1/suspend" },
    { method: :post, path: "/admin/creators/1/unsuspend" },
    { method: :get, path: "/admin/creators" },
    { method: :get, path: "/admin/creators/1" },
    { method: :post, path: "/admin/payouts/1/mark_paid" },
    { method: :post, path: "/admin/payouts/1/cancel" },
    { method: :get, path: "/admin/payouts" },
    { method: :get, path: "/admin/payouts/1" },
    { method: :get, path: "/admin/activity-log" },
    { method: :get, path: "/admin/activity-log/1" },
    { method: :post, path: "/admin/team/1/revoke" },
    { method: :get, path: "/admin/team" },
    { method: :get, path: "/admin/team/1" },
    { method: :post, path: "/admin/products/1/unpublish" },
    { method: :post, path: "/admin/products/1/publish" },
    { method: :get, path: "/admin/products" },
    { method: :get, path: "/admin/products/1" },
    { method: :post, path: "/admin/subscriptions/1/cancel" },
    { method: :get, path: "/admin/subscriptions" },
    { method: :get, path: "/admin/subscriptions/1" },
    { method: :get, path: "/admin/customers" },
    { method: :get, path: "/admin/customers/1" },
    { method: :get, path: "/admin/marketing" },
    { method: :get, path: "/admin/reports" }
  ].freeze

  MOUNTED_ROUTES = [
    { method: :get, path: "/admin/sidekiq" },
    { method: :get, path: "/admin/features" }
  ].freeze

  ALL_ADMIN_ROUTES = (CONTROLLER_ROUTES + MOUNTED_ROUTES).freeze

  def perform_request(route)
    case route[:method]
    when :get
      get route[:path]
    when :post
      post route[:path]
    when :delete
      delete route[:path]
    end
  end

  def perform_request_json(route)
    case route[:method]
    when :get
      get route[:path], as: :json
    when :post
      post route[:path], as: :json
    when :delete
      delete route[:path], as: :json
    end
  end

  describe "Logged-out visitor access" do
    ALL_ADMIN_ROUTES.each do |route|
      it "denies #{route[:method].upcase} #{route[:path]}" do
        if MOUNTED_ROUTES.include?(route)
          perform_request(route)
          expect(response).to have_http_status(:not_found)
        else
          perform_request(route)
          expect(response).to redirect_to(login_path(next: route[:path]))
        end
      end
    end

    it "returns 404 JSON for XHR/JSON requests to controller routes" do
      perform_request_json(CONTROLLER_ROUTES.first)
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "Normal seller access (is_team_member: false)" do
    before { sign_in seller }

    ALL_ADMIN_ROUTES.each do |route|
      it "denies #{route[:method].upcase} #{route[:path]}" do
        if MOUNTED_ROUTES.include?(route)
          perform_request(route)
          expect(response).to have_http_status(:not_found)
        else
          perform_request(route)
          expect(response).to redirect_to(root_path)
        end
      end
    end
  end

  describe "Buyer access" do
    before { sign_in buyer }

    ALL_ADMIN_ROUTES.each do |route|
      it "denies #{route[:method].upcase} #{route[:path]}" do
        if MOUNTED_ROUTES.include?(route)
          perform_request(route)
          expect(response).to have_http_status(:not_found)
        else
          perform_request(route)
          expect(response).to redirect_to(root_path)
        end
      end
    end
  end

  describe "Seller team member access across all roles" do
    TeamMembership::ROLES.each do |role|
      context "with seller team membership role: #{role}" do
        let(:team_user) do
          user = create(:user, email: "seller_#{role}@example.com", is_team_member: false)
          user.create_owner_membership_if_needed!
          user.user_memberships.create!(seller: seller, role: role) unless role == TeamMembership::ROLE_OWNER
          user
        end

        before { sign_in team_user }

        ALL_ADMIN_ROUTES.each do |route|
          it "denies #{route[:method].upcase} #{route[:path]}" do
            if MOUNTED_ROUTES.include?(route)
              perform_request(route)
              expect(response).to have_http_status(:not_found)
            else
              perform_request(route)
              expect(response).to redirect_to(root_path)
            end
          end
        end
      end
    end
  end

  describe "Staff user without 2FA in production configuration" do
    before do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("ADMIN_REQUIRE_2FA").and_return("true")
      sign_in staff_without_2fa
    end

    ALL_ADMIN_ROUTES.each do |route|
      it "denies #{route[:method].upcase} #{route[:path]} when missing 2FA" do
        if MOUNTED_ROUTES.include?(route)
          perform_request(route)
          expect(response).to have_http_status(:not_found)
        else
          perform_request(route)
          expect(response).to redirect_to(settings_password_path)
          expect(flash[:alert]).to include("Two-factor authentication is required")
        end
      end
    end

    it "returns 403 Forbidden for JSON requests without 2FA" do
      perform_request_json(CONTROLLER_ROUTES.first)
      expect(response).to have_http_status(:forbidden)
      expect(response.parsed_body["error"]).to include("Two-factor authentication is required")
    end

    it "prevents staff without 2FA from impersonating users" do
      get admin_impersonate_path(user_identifier: seller.email)
      expect(response).to redirect_to(settings_password_path)
      expect($redis.get(RedisKey.impersonated_user(staff_without_2fa.id))).to be_nil
    end
  end

  describe "Authorized staff user with 2FA" do
    before do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("ADMIN_REQUIRE_2FA").and_return("true")
      allow(Rails.logger).to receive(:info).and_call_original
      sign_in authorized_admin
    end

    it "allows access to admin root" do
      get admin_root_path
      expect(response).to have_http_status(:ok)
    end

    it "allows impersonating and unimpersonating with audit logging" do
      expect(Rails.logger).to receive(:info).with(/\[ADMIN_AUDIT\].*impersonate_start/).at_least(:once)
      get admin_impersonate_path(user_identifier: seller.email)
      expect(response).to redirect_to(products_path)
      expect($redis.get(RedisKey.impersonated_user(authorized_admin.id)).to_i).to eq(seller.id)

      expect(Rails.logger).to receive(:info).with(/\[ADMIN_AUDIT\].*impersonate_stop/).at_least(:once)
      delete admin_unimpersonate_path
      expect(response).to redirect_to(root_url)
      expect($redis.get(RedisKey.impersonated_user(authorized_admin.id))).to be_nil
    end
  end

  describe "ADMIN_ALLOWED_IPS allowlist" do
    before do
      sign_in authorized_admin
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("ADMIN_ALLOWED_IPS").and_return("192.168.1.0/24,10.0.0.1")
    end

    it "rejects requests from disallowed IPs with 403 Forbidden" do
      get admin_root_path, headers: { "REMOTE_ADDR" => "203.0.113.50" }
      expect(response).to have_http_status(:forbidden)
      expect(response.body).to include("Forbidden: IP not allowed")
    end

    it "permits requests from an allowed single IP" do
      get admin_root_path, headers: { "REMOTE_ADDR" => "10.0.0.1" }
      expect(response).to have_http_status(:ok)
    end

    it "permits requests from an allowed CIDR subnet" do
      get admin_root_path, headers: { "REMOTE_ADDR" => "192.168.1.42" }
      expect(response).to have_http_status(:ok)
    end

    it "blocks mounted routes from disallowed IPs" do
      get "/admin/sidekiq", headers: { "REMOTE_ADDR" => "203.0.113.50" }
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "Impersonation banner" do
    before do
      sign_in authorized_admin
      get admin_impersonate_path(user_identifier: seller.email)
      while response.redirect?
        follow_redirect!
      end
    end

    it "renders the impersonation banner with target user details and stop button" do
      expect(response.body).to include('id="impersonation-banner"')
      expect(response.body).to include(seller.email)
      expect(response.body).to include(authorized_admin.email)
      expect(response.body).to include("Stop Impersonating")
    end
  end
end
