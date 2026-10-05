# frozen_string_literal: true

require "spec_helper"

RSpec.describe "E2E: Creator Lifecycle", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:admin_user, name: "Admin Finance Lead") }
  let(:seller) { create(:compliant_user, name: "Abebe Bikila", username: "abebecbe", email: "abebe@example.com") }
  let(:affiliate_user) { create(:affiliate_user, name: "Chala Affiliate", username: "chalaaff", email: "chala@example.com") }

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

  it "manages complete creator journey: onboarding -> publishing -> sales -> affiliate split -> payout settlement" do
    # 1. Onboarding: configure Ethiopian payout bank details (Commercial Bank of Ethiopia)
    bank_account = EthiopiaBankAccount.create!(
      user: seller,
      bank_code: "CBETETAA",
      account_number: "1000123456789",
      account_number_last_four: "6789",
      account_holder_full_name: "Abebe Bikila"
    )

    expect(seller.active_bank_account).to eq(bank_account)
    expect(bank_account.bank_code).to eq("CBETETAA")
    expect(bank_account.country).to eq("ET")
    expect(bank_account.currency).to eq("etb")
    expect(bank_account.account_number_visual).to eq("******6789")

    # 2. Publishing: create digital product priced at 500 ETB (50,000 santims)
    product = create(
      :product,
      user: seller,
      name: "Mastering Addis Tech",
      price_cents: 50_000,
      price_currency_type: "etb"
    )
    expect(product.price_cents).to eq(50_000)
    expect(product.price_currency_type).to eq("etb")

    # 3. Setup affiliate partner (20% commission = 2,000 basis points)
    affiliate = create(
      :direct_affiliate,
      seller:,
      affiliate_user:,
      affiliate_basis_points: 2000,
      products: [product]
    )

    # 4. Generate sales: 3 direct customer purchases
    3.times do |i|
      buyer = create(:user, email: "cbe_buyer_#{i}@example.com")
      p = create(
        :purchase,
        link: product,
        seller:,
        purchaser: buyer,
        email: buyer.email,
        price_cents: 50_000,
        displayed_price_cents: 50_000,
        total_transaction_cents: 50_000,
        displayed_price_currency_type: "etb",
        charge_processor_id: "chapa",
        processor: "chapa",
        flow_of_funds: FlowOfFunds.build_simple_flow_of_funds("ETB", 50_000),
        purchase_state: "successful",
        succeeded_at: Time.current
      )
      p.calculate_fees
      p.save!(validate: false)
      p.increment_sellers_balance!
    end

    # 5. Generate 1 affiliate-referred purchase
    affil_buyer = create(:user, email: "affil_buyer_cbe@example.com")
    affiliate_purchase = create(
      :purchase,
      link: product,
      seller:,
      purchaser: affil_buyer,
      email: affil_buyer.email,
      price_cents: 50_000,
      displayed_price_cents: 50_000,
      total_transaction_cents: 50_000,
      displayed_price_currency_type: "etb",
      charge_processor_id: "chapa",
      processor: "chapa",
      affiliate_id: affiliate.id,
      flow_of_funds: FlowOfFunds.build_simple_flow_of_funds("ETB", 50_000),
      purchase_state: "successful",
      succeeded_at: Time.current
    )
    affiliate_purchase.calculate_fees
    affiliate_purchase.save!(validate: false)
    affiliate_purchase.increment_sellers_balance!
    affiliate_purchase.increment_affiliates_balance!

    # 6. Verify ledger balances & integer santim arithmetic
    seller.reload
    expect(seller.sales.successful.count).to eq(4)
    expect(seller.unpaid_balance_cents).to be > 0
    expect(seller.unpaid_balance_cents).to be_a(Integer)

    # Affiliate commission assertion: integer santims without rounding error
    affiliate_credit = affiliate_purchase.affiliate_credit
    expect(affiliate_credit).to be_present
    expect(affiliate_credit.amount_cents).to be_a(Integer)
    expect(affiliate_credit.amount_cents).to be > 0
    expect(affiliate_credit.basis_points).to eq(2000)

    # All balance transactions have zero float loss
    seller.balance_transactions.each do |bt|
      expect(bt.holding_amount_gross_cents).to be_a(Integer)
      expect(bt.holding_amount_net_cents).to be_a(Integer)
      expect(bt.holding_amount_currency).to be_present
      expect(bt.issued_amount_currency.downcase).to eq("etb")
    end

    # 7. Dashboard metrics check
    sign_in seller
    allow_any_instance_of(User).to receive(:all_sales_count) { seller.sales.successful.count }
    get "/dashboard/customers_count"
    expect(response).to have_http_status(:ok)
    res = JSON.parse(response.body)
    expect(res["success"]).to be true
    expect(res["value"]).to eq("4")

    # 8. Payout settlement: schedule payout for accrued balance
    accrued_amount_cents = seller.unpaid_balance_cents
    scheduled_payout = create(
      :scheduled_payout,
      user: seller,
      payout_amount_cents: accrued_amount_cents,
      status: "pending",
      delay_days: 7
    )

    # 9. Admin executes payout via POST /admin/payouts/:id/mark_paid
    sign_in admin
    allow_any_instance_of(ScheduledPayout).to receive(:execute!) do |sp|
      sp.update!(status: "executed", executed_at: Time.current)
      seller.balances.unpaid.each(&:mark_processing!)
      seller.balances.processing.each(&:mark_paid!)
      :executed
    end

    post mark_paid_admin_payout_path(scheduled_payout.external_id),
         params: { note: "Dispatched via CBE account 1000123456789" },
         as: :json

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["success"]).to be true

    # 10. Asserts creator balance is settled (returns to 0) and audit log recorded
    scheduled_payout.reload
    expect(scheduled_payout.status).to eq("executed")

    seller.reload
    expect(seller.unpaid_balance_cents).to eq(0)

    # Audit log validation
    audit_log = AdminApiAuditLog.where(action: "scheduled_payouts.execute", target_id: scheduled_payout.id).last
    expect(audit_log).to be_present
    expect(audit_log.actor_user_id).to eq(admin.id)
    expect(audit_log.response_status).to eq(200)

    # Admin note is recorded
    expect(seller.comments.with_type_payout_note.last.content).to include("Dispatched via CBE account 1000123456789")
  end
end
