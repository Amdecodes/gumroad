# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Reviews (Step 11)", type: :request do
  let(:seller) { create(:user, username: "revseller#{SecureRandom.hex(4)}", email: "revseller_#{SecureRandom.hex(4)}@example.com") }
  let(:product) do
    create(
      :product,
      user: seller,
      price_cents: 25_000,
      price_currency_type: "etb",
      display_product_reviews: true
    )
  end
  let(:buyer_email) { "buyer@example.com" }
  let(:tx_ref) { "arifdrop-reviews-tx-#{SecureRandom.hex(6)}" }
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
                    reference: "CHAPA_REV_REF_1",
                    tx_ref:
                  })
  end

  it "allows a verified buyer to submit a review and includes it in product response" do
    # 1. Start purchase
    post "/orders", params: {
      email: buyer_email,
      full_name: "Test Buyer",
      line_items: [
        {
          uid: "uid_reviews_1",
          permalink: product.unique_permalink,
          perceived_price_cents: "25000",
          quantity: "1"
        }
      ]
    }, headers: { "X-Inertia" => "true" }

    expect(response).to have_http_status(:ok)
    purchase = Purchase.last

    # 2. Cannot review before payment
    put "/product_reviews/set", params: {
      link_id: product.unique_permalink,
      purchase_id: purchase.external_id,
      purchase_email_digest: purchase.email_digest,
      rating: 5,
      message: "Great product!"
    }, as: :json

    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    expect(json["success"]).to be false

    # 3. Complete purchase via Chapa webhook
    payload = { event: "charge.complete", tx_ref: }.to_json
    post "/webhooks/chapa", params: payload, headers: {
      "CONTENT_TYPE" => "application/json",
      "HTTP_CHAPA_SIGNATURE" => "valid_sig"
    }

    expect(response).to have_http_status(:ok)
    purchase.reload
    expect(purchase.successful?).to be true

    # 4. Submit review after verified purchase
    put "/product_reviews/set", params: {
      link_id: product.unique_permalink,
      purchase_id: purchase.external_id,
      purchase_email_digest: purchase.email_digest,
      rating: 5,
      message: "Great product!"
    }, as: :json

    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    expect(json["success"]).to be true

    # 5. Review appears in product response
    get "/product_reviews", params: { product_id: product.external_id }
    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    expect(json["reviews"].first["rating"]).to eq(5)
    expect(json["reviews"].first["message"]).to eq("Great product!")
  end
end
