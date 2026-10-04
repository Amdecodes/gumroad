# frozen_string_literal: true

require "spec_helper"

RSpec.describe "POST /orders with Chapa Payment Gateway" do
  let(:seller) { create(:user) }
  let(:product) { create(:product, user: seller, price_cents: 25000, price_currency_type: "etb") }
  let(:guid) { SecureRandom.hex(16) }

  before do
    host! DOMAIN
    cookies[:_gumroad_guid] = guid
  end

  it "initializes Chapa transaction for an ETB order and returns the checkout URL" do
    allow_any_instance_of(Chapa::Client).to receive(:initialize_transaction) do |_client, purchase:, return_url:, callback_url:|
      expect(purchase.price_in_currency_cents).to eq(25000)
      expect(purchase.displayed_price_currency_type.to_s).to eq("etb")
      expect(return_url).to include(purchase.external_id)
      expect(callback_url).to include("/webhooks/chapa")

      {
        success: true,
        tx_ref: "arifdrop-#{purchase.external_id}-abcd",
        checkout_url: "https://checkout.chapa.co/checkout/payment/CHAPA_PAY_URL_99"
      }
    end

    post "/orders", params: {
      email: "buyer@example.com",
      full_name: "Tadesse Mesfin",
      line_items: [
        {
          permalink: product.unique_permalink,
          perceived_price_cents: "25000",
          quantity: "1",
          uid: "uid_line_1"
        }
      ]
    }, headers: { "X-Inertia" => "true" }

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body["success"]).to be true
    expect(body["checkout_url"]).to eq("https://checkout.chapa.co/checkout/payment/CHAPA_PAY_URL_99")
    expect(body["tx_ref"]).to start_with("arifdrop-")

    created_purchase = Purchase.find_by_processor_transaction_id(body["tx_ref"])
    expect(created_purchase).to be_present
    expect(created_purchase.charge_processor_id).to eq("chapa")
    expect(created_purchase.purchase_state).to eq("in_progress")
    expect(created_purchase.displayed_price_cents).to eq(25000)
    expect(created_purchase.price_in_currency_cents).to eq(25000)
  end

  it "returns unprocessable entity when Chapa initialization fails" do
    allow_any_instance_of(Chapa::Client).to receive(:initialize_transaction)
      .and_return({
                    success: false,
                    error: "Chapa service unavailable"
                  })

    post "/orders", params: {
      email: "buyer@example.com",
      full_name: "Tadesse Mesfin",
      line_items: [
        {
          permalink: product.unique_permalink,
          perceived_price_cents: "25000",
          quantity: "1",
          uid: "uid_line_1"
        }
      ]
    }, headers: { "X-Inertia" => "true" }

    expect(response).to have_http_status(:unprocessable_entity)
    body = JSON.parse(response.body)
    expect(body["success"]).to be false
    expect(body["error_message"]).to eq("Chapa service unavailable")
  end
end
