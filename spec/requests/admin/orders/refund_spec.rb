# frozen_string_literal: true

require "spec_helper"

describe "Admin::Orders POST /admin/orders/:id/refund", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:admin_user, name: "Admin Lead") }
  let(:regular_user) { create(:user) }
  let(:seller) { create(:user) }
  let(:product) { create(:product, user: seller, price_cents: 2000) }
  let(:purchase) do
    create(
      :purchase,
      link: product,
      seller:,
      email: "buyer_refund@example.com",
      price_cents: 2000,
      purchase_state: "successful",
      stripe_transaction_id: "ch_test_refund_123"
    )
  end

  around do |example|
    original = ActionController::Base.allow_forgery_protection
    ActionController::Base.allow_forgery_protection = false
    example.run
  ensure
    ActionController::Base.allow_forgery_protection = original
  end

  before do
    host! DOMAIN
    stub_const("GUMROAD_ADMIN_ID", admin.id)
  end

  context "when visitor is not signed in" do
    it "redirects to the login page without minting tokens or creating audit logs" do
      initial_tokens_count = AdminApiToken.count
      initial_audit_count = AdminApiAuditLog.count

      post refund_admin_order_path(purchase.external_id), params: { reason: "Requested refund" }

      expect(response).to redirect_to(login_path(next: refund_admin_order_path(purchase.external_id)))
      expect(AdminApiToken.count).to eq(initial_tokens_count)
      expect(AdminApiAuditLog.count).to eq(initial_audit_count)
    end
  end

  context "when visitor is signed in as a regular user" do
    before { sign_in regular_user }

    it "refuses access and redirects to root" do
      initial_tokens_count = AdminApiToken.count
      initial_audit_count = AdminApiAuditLog.count

      post refund_admin_order_path(purchase.external_id), params: { reason: "Requested refund" }

      expect(response).to redirect_to(root_path)
      expect(AdminApiToken.count).to eq(initial_tokens_count)
      expect(AdminApiAuditLog.count).to eq(initial_audit_count)
    end
  end

  context "when signed in as an authorized admin team member" do
    before { sign_in admin }

    it "validates that reason is required before minting tokens" do
      initial_tokens_count = AdminApiToken.count
      initial_audit_count = AdminApiAuditLog.count

      post refund_admin_order_path(purchase.external_id), params: { reason: "   " }

      expect(response).to redirect_to(admin_order_path(purchase.external_id))
      expect(flash[:alert]).to include("reason is required")
      expect(AdminApiToken.count).to eq(initial_tokens_count)
      expect(AdminApiAuditLog.count).to eq(initial_audit_count)
    end

    it "returns 400 for blank reason on json request" do
      post refund_admin_order_path(purchase.external_id), params: { reason: "" }, as: :json

      expect(response).to have_http_status(:bad_request)
      body = JSON.parse(response.body)
      expect(body["success"]).to be(false)
      expect(body["message"]).to include("reason is required")
    end

    it "performs full refund in-process, creates exactly 1 audit log row, and revokes the token" do
      initial_tokens_count = AdminApiToken.count
      initial_audit_count = AdminApiAuditLog.count

      allow(Purchase).to receive(:find_by_external_id_numeric)
        .with(purchase.external_id_numeric)
        .and_return(purchase)
      allow(purchase).to receive(:within_refund_policy_timeframe?).and_return(true)
      allow(purchase).to receive(:purchase_refund_policy).and_return(double("Policy", fine_print: nil))
      allow(purchase).to receive(:amount_refundable_cents).and_return(2000)
      expect(purchase).to receive(:refund!).with(
        refunding_user_id: admin.id,
        amount: nil,
        reason: "Customer requested cancellation"
      ).and_return(true)

      post refund_admin_order_path(purchase.external_id), params: { reason: "Customer requested cancellation" }

      expect(response).to redirect_to(admin_order_path(purchase.external_id))
      follow_redirect!
      expect(response).to have_http_status(:ok)
      expect(flash[:notice]).to include("Successfully refunded")

      # 1. Exactly one audit log row created
      expect(AdminApiAuditLog.count).to eq(initial_audit_count + 1)
      latest_log = AdminApiAuditLog.last
      expect(latest_log).to have_attributes(
        action: "purchases.refund",
        actor_user_id: admin.id,
        target_type: "Purchase",
        target_id: purchase.id,
        target_external_id: purchase.external_id,
        response_status: 200
      )

      # 2. Token was minted and revoked
      expect(AdminApiToken.count).to eq(initial_tokens_count + 1)
      latest_token = AdminApiToken.last
      expect(latest_token.actor_user_id).to eq(admin.id)
      expect(latest_token.active?).to be(false)
      expect(session[:token]).to be_blank

      # 3. Outer request session remains logged in as admin
      get admin_root_path
      expect(response).to have_http_status(:ok)
      expect(controller.current_user).to eq(admin)
    end

    it "passes API validation error messages through verbatim" do
      allow(Purchase).to receive(:find_by_external_id_numeric)
        .with(purchase.external_id_numeric)
        .and_return(purchase)
      allow(purchase).to receive(:stripe_refunded).and_return(true)

      post refund_admin_order_path(purchase.external_id), params: { reason: "Already refunded" }

      expect(response).to redirect_to(admin_order_path(purchase.external_id))
      expect(flash[:alert]).to eq("Purchase has already been fully refunded")
    end
  end
end
