# frozen_string_literal: true

require "spec_helper"

describe "Admin::Orders POST /admin/orders/:id/cancel_subscription", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:admin_user, name: "Admin Lead") }
  let(:regular_user) { create(:user) }
  let(:seller) { create(:user) }
  let(:product) { create(:product, user: seller, price_cents: 1500) }
  let(:purchaser) { create(:user) }
  let(:subscription) { create(:subscription, user: purchaser, link: product) }
  let(:purchase) do
    p = create(:free_purchase, link: product, seller:, purchaser:, email: "subscriber@example.com")
    p.subscription = subscription
    p.is_original_subscription_purchase = true
    p.save(validate: false)
    p
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

      post cancel_subscription_admin_order_path(purchase.external_id)

      expect(response).to redirect_to(login_path(next: cancel_subscription_admin_order_path(purchase.external_id)))
      expect(AdminApiToken.count).to eq(initial_tokens_count)
      expect(AdminApiAuditLog.count).to eq(initial_audit_count)
    end
  end

  context "when visitor is signed in as a regular user" do
    before { sign_in regular_user }

    it "refuses access and redirects to root" do
      initial_tokens_count = AdminApiToken.count
      initial_audit_count = AdminApiAuditLog.count

      post cancel_subscription_admin_order_path(purchase.external_id)

      expect(response).to redirect_to(root_path)
      expect(AdminApiToken.count).to eq(initial_tokens_count)
      expect(AdminApiAuditLog.count).to eq(initial_audit_count)
    end
  end

  context "when signed in as an authorized admin team member" do
    before { sign_in admin }

    it "cancels subscription in-process, creates exactly 1 audit log row, and revokes the token" do
      initial_tokens_count = AdminApiToken.count
      initial_audit_count = AdminApiAuditLog.count

      expect(subscription).to receive(:cancel!).with(by_seller: false, by_admin: true).and_return(true)
      allow(Purchase).to receive(:find_by_external_id_numeric)
        .with(purchase.external_id_numeric)
        .and_return(purchase)
      allow(purchase).to receive(:subscription).and_return(subscription)

      post cancel_subscription_admin_order_path(purchase.external_id)

      expect(response).to redirect_to(admin_order_path(purchase.external_id))
      follow_redirect!
      expect(response).to have_http_status(:ok)
      expect(flash[:notice]).to include("Successfully cancelled subscription")

      # 1. Exactly one audit log row created
      expect(AdminApiAuditLog.count).to eq(initial_audit_count + 1)
      latest_log = AdminApiAuditLog.last
      expect(latest_log).to have_attributes(
        action: "purchases.cancel_subscription",
        actor_user_id: admin.id,
        target_type: "Purchase",
        target_id: purchase.id,
        target_external_id: purchase.external_id,
        response_status: 200
      )

      # 2. Token minted and revoked
      expect(AdminApiToken.count).to eq(initial_tokens_count + 1)
      latest_token = AdminApiToken.last
      expect(latest_token.actor_user_id).to eq(admin.id)
      expect(latest_token.active?).to be(false)

      # 3. Outer session remains unaffected
      get admin_root_path
      expect(response).to have_http_status(:ok)
      expect(controller.current_user).to eq(admin)
    end

    it "passes API validation error messages when order has no subscription" do
      order_without_sub = create(:free_purchase, link: product, seller:, email: "no_sub@example.com")

      post cancel_subscription_admin_order_path(order_without_sub.external_id)

      expect(response).to redirect_to(admin_order_path(order_without_sub.external_id))
      expect(flash[:alert]).to eq("Purchase has no subscription")
    end
  end
end
