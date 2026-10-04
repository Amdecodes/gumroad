# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Discounts (Step 11)", type: :request do
  let(:seller) { create(:user, email: "seller@example.com") }
  let(:product) { create(:product, user: seller, price_cents: 25_000, price_currency_type: "etb") }
  let(:buyer_email) { "buyer@example.com" }
  let(:guid) { SecureRandom.hex(16) }

  before do
    host! DOMAIN
    cookies[:_gumroad_guid] = guid
  end

  describe "Percentage offer code" do
    let(:offer_code) { create(:offer_code, user: seller, amount_percentage: 20, code: "TWENTYOFF") }

    before do
      offer_code.products << product
    end

    it "applies 20% off and charges 20000 santims via Chapa" do
      allow_any_instance_of(Chapa::Client).to receive(:initialize_transaction) do |_client, purchase:, return_url:, callback_url:|
        expect(purchase.price_in_currency_cents).to eq(20_000)
        expect(purchase.displayed_price_currency_type.to_s).to eq("etb")
        {
          success: true,
          tx_ref: "arifdrop-#{purchase.external_id}-123",
          checkout_url: "https://checkout.chapa.co/checkout/payment/123"
        }
      end

      post "/orders", params: {
        email: buyer_email,
        full_name: "Test Buyer",
        line_items: [
          {
            uid: "uid_discount_1",
            permalink: product.unique_permalink,
            perceived_price_cents: "20000",
            quantity: "1",
            discount_code: offer_code.code
          }
        ]
      }, headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["success"]).to be true
      expect(json["checkout_url"]).to eq("https://checkout.chapa.co/checkout/payment/123")

      purchase = Purchase.last
      expect(purchase.displayed_price_cents).to eq(20_000)
      expect(purchase.price_in_currency_cents).to eq(20_000)
      expect(purchase.offer_code).to eq(offer_code)
    end
  end

  describe "Fixed-amount ETB offer code" do
    let(:offer_code) { create(:offer_code, user: seller, amount_cents: 5_000, code: "5000OFF", currency_type: "etb") }

    before do
      offer_code.products << product
    end

    it "applies 5000 santims off and charges 20000 santims via Chapa" do
      allow_any_instance_of(Chapa::Client).to receive(:initialize_transaction) do |_client, purchase:, return_url:, callback_url:|
        expect(purchase.price_in_currency_cents).to eq(20_000)
        expect(purchase.displayed_price_currency_type.to_s).to eq("etb")
        {
          success: true,
          tx_ref: "arifdrop-#{purchase.external_id}-456",
          checkout_url: "https://checkout.chapa.co/checkout/payment/456"
        }
      end

      post "/orders", params: {
        email: buyer_email,
        full_name: "Test Buyer",
        line_items: [
          {
            uid: "uid_discount_2",
            permalink: product.unique_permalink,
            perceived_price_cents: "20000",
            quantity: "1",
            discount_code: offer_code.code
          }
        ]
      }, headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["success"]).to be true
      expect(json["checkout_url"]).to eq("https://checkout.chapa.co/checkout/payment/456")

      purchase = Purchase.last
      expect(purchase.displayed_price_cents).to eq(20_000)
      expect(purchase.price_in_currency_cents).to eq(20_000)
      expect(purchase.offer_code).to eq(offer_code)
    end
  end

  describe "100%-off code" do
    let(:offer_code) { create(:offer_code, user: seller, amount_percentage: 100, code: "FREEBIE") }

    before do
      offer_code.products << product
    end

    it "results in free purchase with no Chapa call" do
      expect_any_instance_of(Chapa::Client).not_to receive(:initialize_transaction)

      post "/orders", params: {
        email: buyer_email,
        full_name: "Test Buyer",
        line_items: [
          {
            uid: "uid_discount_3",
            permalink: product.unique_permalink,
            perceived_price_cents: "0",
            quantity: "1",
            discount_code: offer_code.code
          }
        ]
      }, headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["success"]).to be true
      expect(json["checkout_url"]).to be_nil

      purchase = Purchase.last
      expect(purchase.price_cents).to eq(0)
      expect(purchase.successful?).to be true
      expect(purchase.offer_code).to eq(offer_code)
    end
  end
end
