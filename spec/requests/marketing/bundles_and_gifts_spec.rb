# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Bundles and Gifts (Step 11)", type: :request do
  let(:seller) { create(:user, username: "bguser#{SecureRandom.hex(4)}", email: "bguser_#{SecureRandom.hex(4)}@example.com") }
  let(:product) { create(:product, user: seller, price_cents: 25_000, price_currency_type: "etb") }
  let(:buyer_email) { "buyer@example.com" }
  let(:tx_ref) { "arifdrop-bg-tx-#{SecureRandom.hex(6)}" }
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
                    reference: "CHAPA_BG_REF_1",
                    tx_ref:
                  })
  end

  describe "Gifting a product" do
    it "captures recipient email and creates a gift record upon Chapa payment completion" do
      post "/orders", params: {
        email: buyer_email,
        purchase: { email: buyer_email },
        full_name: "Gifter Buyer",
        is_gift: "true",
        giftee_email: "giftee@example.com",
        gift_note: "Enjoy your gift!",
        line_items: [
          {
            uid: "uid_gift_1",
            permalink: product.unique_permalink,
            perceived_price_cents: "25000",
            quantity: "1"
          }
        ]
      }, headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      gift = Gift.last
      expect(gift).to be_present
      expect(gift.giftee_email).to eq("giftee@example.com")
      expect(gift.gift_note).to eq("Enjoy your gift!")

      gifter_purchase = gift.gifter_purchase
      expect(gifter_purchase.is_gift_sender_purchase).to be true

      # Complete purchase via webhook
      payload = { event: "charge.complete", tx_ref: }.to_json
      post "/webhooks/chapa", params: payload, headers: {
        "CONTENT_TYPE" => "application/json",
        "HTTP_CHAPA_SIGNATURE" => "valid_sig"
      }

      expect(response).to have_http_status(:ok)
      expect(gifter_purchase.reload.successful?).to be true
      expect(gift.reload.successful?).to be true
    end
  end

  describe "Bundle purchases" do
    let(:bundle) { create(:product, :bundle, user: seller, price_cents: 40_000, price_currency_type: "etb") }

    it "initializes Chapa transaction with the bundle price in ETB santims" do
      allow_any_instance_of(Chapa::Client).to receive(:initialize_transaction) do |_client, purchase:, return_url:, callback_url:|
        expect(purchase.price_in_currency_cents).to eq(40_000)
        expect(purchase.displayed_price_currency_type.to_s).to eq("etb")
        {
          success: true,
          tx_ref: "arifdrop-bundle-tx",
          checkout_url: "https://checkout.chapa.co/checkout/payment/bundle"
        }
      end

      bundle_items_payload = bundle.bundle_products.map do |bp|
        { product_id: bp.product.external_id, quantity: bp.quantity }
      end

      post "/orders", params: {
        email: buyer_email,
        full_name: "Bundle Buyer",
        line_items: [
          {
            uid: "uid_bundle_1",
            permalink: bundle.unique_permalink,
            perceived_price_cents: "40000",
            quantity: "1",
            bundle_products: bundle_items_payload
          }
        ]
      }, headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      purchase = Purchase.last
      expect(purchase.price_in_currency_cents).to eq(40_000)
      expect(purchase.link).to eq(bundle)
      expect(bundle.bundle_products.count).to eq(2)
    end
  end
end
