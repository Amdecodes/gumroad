# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Affiliates (Step 11)", type: :request do
  let(:seller) { create(:user, username: "seller#{SecureRandom.hex(4)}", email: "seller_#{SecureRandom.hex(4)}@example.com") }
  let(:product) { create(:product, user: seller, price_cents: 25_000, price_currency_type: "etb") }
  let(:affiliate_user) { create(:affiliate_user, username: "affil#{SecureRandom.hex(4)}", email: "affil_#{SecureRandom.hex(4)}@example.com") }
  let(:affiliate) { create(:direct_affiliate, seller:, affiliate_user:, affiliate_basis_points: 1000, products: [product]) } # 10%
  let(:buyer_email) { "buyer@example.com" }
  let(:tx_ref) { "arifdrop-affiliate-tx-#{SecureRandom.hex(6)}" }
  let(:guid) { SecureRandom.hex(16) }

  before do
    host! DOMAIN
    cookies[:_gumroad_guid] = guid

    allow_any_instance_of(Chapa::Client).to receive(:initialize_transaction) do |_client, purchase:, return_url:, callback_url:|
      {
        success: true,
        tx_ref:,
        checkout_url: "https://checkout.chapa.co/checkout/payment/123"
      }
    end

    allow_any_instance_of(Chapa::Client).to receive(:valid_signature?).and_return(true)
    allow_any_instance_of(Chapa::Client).to receive(:verify_transaction)
      .with(tx_ref)
      .and_return({
                    success: true,
                    status: "success",
                    amount: 250.00,
                    currency: "ETB",
                    reference: "CHAPA_AFF_REF_1",
                    tx_ref:
                  })
  end

  it "tracks affiliate via cookie and calculates integer commission in santims after payment" do
    # 1. Buyer follows affiliate link, setting the tracking cookie
    cookies[affiliate.cookie_key] = Time.current.to_i.to_s

    # 2. Start purchase (affiliate cookie is automatically read by OrdersController)
    post "/orders", params: {
      email: buyer_email,
      full_name: "Test Buyer",
      line_items: [
        {
          uid: "uid_aff_line_1",
          permalink: product.unique_permalink,
          perceived_price_cents: "25000",
          quantity: "1",
          affiliate_id: affiliate.external_id_numeric
        }
      ]
    }, headers: { "X-Inertia" => "true" }

    expect(response).to have_http_status(:ok)
    purchase = Purchase.last
    expect(purchase.affiliate_id).to eq(affiliate.id)

    # 3. Simulate Chapa webhook verification
    payload = { event: "charge.complete", tx_ref: }.to_json
    post "/webhooks/chapa", params: payload, headers: {
      "CONTENT_TYPE" => "application/json",
      "HTTP_CHAPA_SIGNATURE" => "valid_sig"
    }

    expect(response).to have_http_status(:ok)
    purchase.reload
    expect(purchase.successful?).to be true

    # 4. Verify affiliate credit in integer santims
    credit = purchase.affiliate_credit
    expect(credit).to be_present

    # Affiliate cut with shared fees in integer santims: (net_cents * basis_points) / 10_000
    expect(credit.amount_cents).to eq(purchase.send(:determine_affiliate_balance_cents))
    expect(credit.amount_cents).to be_a(Integer)
    expect(credit.amount_cents).to be > 0
    expect(credit.basis_points).to eq(1000)
  end
end
