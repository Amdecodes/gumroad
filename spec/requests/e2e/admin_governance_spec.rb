# frozen_string_literal: true

require "spec_helper"

RSpec.describe "E2E: Platform Governance & Admin Operations", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:admin_user, name: "Admin Risk Lead") }
  let(:seller) { create(:compliant_user, name: "Legit Seller", username: "legitseller", email: "seller@example.com") }
  let(:product) { create(:product, user: seller, name: "ETB Software Kit", price_cents: 35_000, price_currency_type: "etb") }
  let(:product_file) { create(:product_file, link: product) }

  let!(:rogue_creator) { create(:compliant_user, name: "Rogue Creator", username: "roguecreator", email: "rogue@example.com") }
  let!(:rogue_product) { create(:product, user: rogue_creator, name: "Prohibited Goods", price_cents: 10_000, price_currency_type: "etb") }

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
    allow_any_instance_of(LinksController).to receive(:check_if_needs_redirect).and_return(nil)
    allow_any_instance_of(UsersController).to receive(:check_if_needs_redirect).and_return(nil)
  end

  it "executes admin platform monitoring, order investigation, refund with access revocation, and creator suspension" do
    # 1. Admin logs in and inspects the /admin Overview dashboard
    sign_in admin, scope: :user
    get admin_root_path, headers: { "X-Inertia" => "true" }

    expect(response).to have_http_status(:ok)
    overview_body = JSON.parse(response.body)
    expect(overview_body["component"]).to eq("Admin/Overview")
    metrics = overview_body.dig("props", "metrics")
    expect(metrics).to have_key("revenue")
    expect(metrics["revenue"]["formatted"]).to include("ETB")
    expect(metrics).to have_key("orders_count")
    expect(metrics).to have_key("creators_count")
    expect(metrics).to have_key("customers_count")

    # 2. Setup an active ETB purchase with digital download
    buyer = create(:user, email: "buyer_refund_e2e@example.com")
    purchase = create(
      :purchase,
      link: product,
      seller:,
      purchaser: buyer,
      email: buyer.email,
      price_cents: 35_000,
      displayed_price_cents: 35_000,
      total_transaction_cents: 35_000,
      displayed_price_currency_type: "etb",
      charge_processor_id: "chapa",
      processor: "chapa",
      stripe_transaction_id: "chapa_tx_ref_e2e_123",
      flow_of_funds: FlowOfFunds.build_simple_flow_of_funds("ETB", 35_000),
      purchase_state: "successful",
      succeeded_at: Time.current
    )
    purchase.calculate_fees
    purchase.save!(validate: false)
    purchase.increment_sellers_balance!

    url_redirect = create(:url_redirect, purchase:, link: product)
    initial_seller_balance = seller.reload.unpaid_balance_cents
    expect(initial_seller_balance).to be > 0

    # 3. Admin investigates flagged order via GET /admin/orders/:id
    get admin_order_path(purchase.external_id), headers: { "X-Inertia" => "true" }
    expect(response).to have_http_status(:ok)
    order_body = JSON.parse(response.body)
    expect(order_body["component"]).to eq("Admin/Orders/Show")

    # 4. Admin issues full refund via POST /admin/orders/:id/refund with reason
    allow(Purchase).to receive(:find_by_external_id_numeric)
      .with(purchase.external_id_numeric)
      .and_return(purchase)
    allow(purchase).to receive(:within_refund_policy_timeframe?).and_return(true)
    allow(purchase).to receive(:purchase_refund_policy).and_return(double("Policy", fine_print: nil))
    allow(purchase).to receive(:amount_refundable_cents).and_return(35_000)
    allow(purchase).to receive(:refund!).with(
      refunding_user_id: admin.id,
      amount: nil,
      reason: "Product materially defective"
    ) do
      purchase.update!(stripe_refunded: true)
      seller.balances.each { |b| b.update!(amount_cents: 0) }
      true
    end

    post refund_admin_order_path(purchase.external_id),
         params: { reason: "Product materially defective" },
         as: :json

    expect(response).to have_http_status(:ok)

    # 5. Asserts purchase transitions to refunded state and seller balance is decremented
    purchase.reload
    expect(purchase.refunded?).to be true
    expect(purchase.stripe_refunded).to be true
    expect(seller.reload.unpaid_balance_cents).to be < initial_seller_balance

    # 6. Asserts buyer download access is immediately revoked with 403 Forbidden
    cookies[:_gumroad_guid] = purchase.browser_guid
    get url_redirect_download_product_files_path(url_redirect.token, product_file_ids: [product_file.external_id])
    expect(response).to have_http_status(:forbidden)

    # Asserts AdminApiAuditLog records the refund action
    refund_audit_log = AdminApiAuditLog.where(action: "purchases.refund", target_id: purchase.id).last
    expect(refund_audit_log).to be_present
    expect(refund_audit_log.actor_user_id).to eq(admin.id)
    expect(refund_audit_log.response_status).to eq(200)

    # 7. Creator moderation: suspend rogue creator via POST /admin/creators/:id/suspend
    post suspend_admin_creator_path(rogue_creator.external_id),
         params: { reason: "Distributing prohibited materials", reason_type: "tos" },
         as: :json

    expect(response).to have_http_status(:ok)

    # 8. Asserts rogue creator risk state is suspended and products are banned
    rogue_creator.reload
    expect(rogue_creator.suspended_for_tos_violation?).to be true
    expect(rogue_creator.account_active?).to be false

    rogue_product.reload
    expect(rogue_product.banned?).to be true
    expect(rogue_product.alive?).to be false

    # 9. Asserts public storefront returns 404
    get "/#{rogue_creator.username}"
    expect(response).to have_http_status(:not_found)

    # Asserts product page returns 404
    get "/l/#{rogue_product.unique_permalink}"
    expect(response).to have_http_status(:not_found)

    # 10. Asserts AdminApiAuditLog records the creator suspension
    suspend_audit_log = AdminApiAuditLog.where(action: "users.suspend_for_tos_violation", target_id: rogue_creator.id).last
    expect(suspend_audit_log).to be_present
    expect(suspend_audit_log.actor_user_id).to eq(admin.id)
    expect(suspend_audit_log.response_status).to eq(200)
  end
end
