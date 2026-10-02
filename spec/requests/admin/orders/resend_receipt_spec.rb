# frozen_string_literal: true

require "spec_helper"

describe "Admin::Orders POST /admin/orders/:id/resend_receipt", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:admin_user, name: "Admin Lead") }
  let(:regular_user) { create(:user) }
  let(:purchase) { create(:free_purchase, email: "buyer_orders@example.com") }

  # `protect_from_forgery` null-sessions unverified non-GET requests in test mode;
  # toggle off around specs that send raw POST requests without CSRF meta tokens.
  around do |example|
    original = ActionController::Base.allow_forgery_protection
    ActionController::Base.allow_forgery_protection = false
    example.run
  ensure
    ActionController::Base.allow_forgery_protection = original
  end

  before do
    host! DOMAIN
  end

  it "enforces CSRF protection on the controller level, unlike internal API controllers" do
    expect(Admin::OrdersController.ancestors).to include(ActionController::RequestForgeryProtection)
    expect(Api::Internal::Admin::BaseController.new.send(:protect_against_forgery?)).to be(false)
  end

  context "when visitor is not signed in" do
    it "redirects to the login page before minting tokens or creating audit logs" do
      initial_tokens_count = AdminApiToken.count
      initial_audit_count = AdminApiAuditLog.count

      post resend_receipt_admin_order_path(purchase.external_id)

      expect(response).to redirect_to(login_path(next: resend_receipt_admin_order_path(purchase.external_id)))
      expect(AdminApiToken.count).to eq(initial_tokens_count)
      expect(AdminApiAuditLog.count).to eq(initial_audit_count)
      expect(SendPurchaseReceiptJob.jobs.size).to eq(0)
    end
  end

  context "when visitor is signed in as a regular user (non-team member)" do
    before { sign_in regular_user }

    it "refuses access and redirects to root without minting tokens or creating audit logs" do
      initial_tokens_count = AdminApiToken.count
      initial_audit_count = AdminApiAuditLog.count

      post resend_receipt_admin_order_path(purchase.external_id)

      expect(response).to redirect_to(root_path)
      expect(AdminApiToken.count).to eq(initial_tokens_count)
      expect(AdminApiAuditLog.count).to eq(initial_audit_count)
      expect(SendPurchaseReceiptJob.jobs.size).to eq(0)
    end
  end

  context "when signed in as an authorized admin team member" do
    before { sign_in admin }

    it "performs receipt resend, creates exactly one audit log row, and revokes the token" do
      initial_audit_count = AdminApiAuditLog.count
      initial_tokens_count = AdminApiToken.count

      post resend_receipt_admin_order_path(purchase.external_id)

      expect(response).to redirect_to(admin_order_path(purchase.external_id))
      follow_redirect!
      expect(response).to have_http_status(:ok)
      expect(flash[:notice]).to include("Successfully resent receipt")

      # 1. Real existing behavior: enqueues receipt job
      expect(SendPurchaseReceiptJob).to have_enqueued_sidekiq_job(purchase.id, true).on("critical")

      # 2. Audit log created with correct attributes
      expect(AdminApiAuditLog.count).to eq(initial_audit_count + 1)
      latest_log = AdminApiAuditLog.last
      expect(latest_log).to have_attributes(
        action: "purchases.resend_receipt",
        actor_user_id: admin.id,
        target_type: "Purchase",
        target_id: purchase.id,
        target_external_id: purchase.external_id,
        response_status: 200
      )

      # 3. Exactly one short-lived token was minted and revoked
      expect(AdminApiToken.count).to eq(initial_tokens_count + 1)
      latest_token = AdminApiToken.last
      expect(latest_token.actor_user_id).to eq(admin.id)
      expect(latest_token.revoked_at).to be_present
      expect(latest_token.active?).to be(false)

      # Token hash must not match plaintext token in logs/session
      expect(session[:token]).to be_blank
      expect(session[:admin_token]).to be_blank

      # 4. Outer request still has current_user and can proceed normally
      get admin_root_path
      expect(response).to have_http_status(:ok)
      expect(controller.current_user).to eq(admin)
    end

    it "supports json requests and returns success payload" do
      post resend_receipt_admin_order_path(purchase.external_id), as: :json

      expect(response).to have_http_status(:ok)
      parsed = JSON.parse(response.body)
      expect(parsed["success"]).to be(true)
      expect(parsed["message"]).to include("Successfully resent receipt")

      expect(SendPurchaseReceiptJob).to have_enqueued_sidekiq_job(purchase.id, true).on("critical")
      expect(AdminApiToken.last.active?).to be(false)
    end

    it "handles not found purchases safely without writing audit logs" do
      initial_audit_count = AdminApiAuditLog.count

      post resend_receipt_admin_order_path("non-existent-order-id")

      expect(response).to redirect_to(admin_orders_path)
      expect(flash[:alert]).to eq("Order not found")
      expect(AdminApiAuditLog.count).to eq(initial_audit_count)
      expect(SendPurchaseReceiptJob.jobs.size).to eq(0)
    end

    it "renders the order show page with the resend receipt UI hook" do
      get admin_order_path(purchase.external_id), headers: { "X-Inertia" => "true" }

      expect(response).to be_successful
      body = JSON.parse(response.body)
      expect(body["component"]).to eq("Admin/Orders/Show")
      expect(body["props"]["order"]["id"]).to eq(purchase.external_id)
      expect(body["props"]["order"]["customer_email"]).to eq(purchase.email)
    end
  end
end
