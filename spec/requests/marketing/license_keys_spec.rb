# frozen_string_literal: true

require "spec_helper"

RSpec.describe "License Keys (Step 11)", type: :request do
  let(:seller) { create(:user, username: "licseller#{SecureRandom.hex(4)}", email: "licseller_#{SecureRandom.hex(4)}@example.com") }
  let(:product) { create(:product, user: seller, price_cents: 25_000, price_currency_type: "etb", is_licensed: true) }
  let(:buyer_email) { "buyer@example.com" }
  let(:tx_ref) { "arifdrop-license-tx-#{SecureRandom.hex(6)}" }
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
                    reference: "CHAPA_LIC_REF_1",
                    tx_ref:
                  })
  end

  it "generates a license on purchase completion and verifies it via API" do
    # 1. Start purchase
    post "/orders", params: {
      email: buyer_email,
      full_name: "Test Buyer",
      line_items: [
        {
          uid: "uid_license_1",
          permalink: product.unique_permalink,
          perceived_price_cents: "25000",
          quantity: "1"
        }
      ]
    }, headers: { "X-Inertia" => "true" }

    expect(response).to have_http_status(:ok)
    purchase = Purchase.last
    expect(purchase.license).to be_nil

    # 2. Complete purchase via Chapa webhook
    payload = { event: "charge.complete", tx_ref: }.to_json
    post "/webhooks/chapa", params: payload, headers: {
      "CONTENT_TYPE" => "application/json",
      "HTTP_CHAPA_SIGNATURE" => "valid_sig"
    }

    expect(response).to have_http_status(:ok)
    purchase.reload
    expect(purchase.successful?).to be true
    expect(purchase.license).to be_present

    license_serial = purchase.license.serial
    expect(license_serial).to be_present

    # 3. Verify valid license via API v2 endpoint
    post "/api/v2/licenses/verify", params: {
      product_id: product.external_id,
      license_key: license_serial
    }

    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    expect(json["success"]).to be true
    expect(json["uses"]).to eq(1)

    # 4. Verify invalid license key
    post "/api/v2/licenses/verify", params: {
      product_id: product.external_id,
      license_key: "INVALID-SERIAL-KEY"
    }

    expect(response).to have_http_status(:not_found)
    json = JSON.parse(response.body)
    expect(json["success"]).to be false
  end
end
