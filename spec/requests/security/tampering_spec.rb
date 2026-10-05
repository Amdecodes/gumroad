# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Security: Parameter & Webhook Tampering Defense", type: :request do
  let(:seller) { create(:user) }
  let(:paid_product) { create(:product, user: seller, price_cents: 50000, price_currency_type: "etb") }
  let(:guid) { SecureRandom.hex(16) }

  before do
    host! DOMAIN
    cookies[:_gumroad_guid] = guid
  end

  describe "OrdersController Parameter Tampering Defense" do
    it "rejects checkout attempts with negative price with 422 Unprocessable Content" do
      post "/orders", params: {
        email: "buyer@example.com",
        line_items: [
          {
            permalink: paid_product.unique_permalink,
            price_cents: -500,
            quantity: "1",
            uid: "uid_1"
          }
        ]
      }, headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:unprocessable_content)
      body = JSON.parse(response.body)
      expect(body["success"]).to be false
      expect(body["error_message"]).to include("negative prices are not allowed")
    end

    it "rejects checkout attempts with zero price for a non-free product with 422" do
      post "/orders", params: {
        email: "buyer@example.com",
        line_items: [
          {
            permalink: paid_product.unique_permalink,
            price_cents: 0,
            quantity: "1",
            uid: "uid_1"
          }
        ]
      }, headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:unprocessable_content)
      body = JSON.parse(response.body)
      expect(body["success"]).to be false
      expect(body["error_message"]).to include("product is not free")
    end

    it "rejects client-forged currency types when stripe_payments is disabled" do
      post "/orders", params: {
        email: "buyer@example.com",
        currency: "USD",
        line_items: [
          {
            permalink: paid_product.unique_permalink,
            perceived_price_cents: "50000",
            quantity: "1",
            uid: "uid_1"
          }
        ]
      }, headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:unprocessable_content)
      body = JSON.parse(response.body)
      expect(body["success"]).to be false
      expect(body["error_message"]).to include("not supported. Please use ETB")
    end
  end

  describe "Webhooks::ChapaController HMAC & Signature Tampering Defense" do
    let(:secret_key) { "test_chapa_secret_key_12345" }
    let(:purchase) do
      create(:purchase,
             link: paid_product,
             purchaser: create(:user),
             price_cents: 50000,
             displayed_price_currency_type: "etb",
             purchase_state: "in_progress",
             processor_transaction_id: "tx-tamper-test-123",
             charge_processor_id: "chapa")
    end

    before do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("CHAPA_WEBHOOK_SECRET").and_return(secret_key)
      allow(ENV).to receive(:[]).with("CHAPA_SECRET_KEY").and_return(secret_key)
    end

    it "rejects webhooks with missing signature with 401 Unauthorized" do
      payload = {
        event: "charge.complete",
        tx_ref: purchase.processor_transaction_id,
        status: "success"
      }.to_json

      post "/webhooks/chapa", params: payload, headers: { "CONTENT_TYPE" => "application/json" }

      expect(response).to have_http_status(:unauthorized)
      body = JSON.parse(response.body)
      expect(body["error"]).to eq("Invalid signature")
    end

    it "rejects webhooks with forged or invalid HMAC signatures with 401 Unauthorized" do
      payload = {
        event: "charge.complete",
        tx_ref: purchase.processor_transaction_id,
        status: "success"
      }.to_json

      forged_signature = "forged_invalid_signature_hash"

      post "/webhooks/chapa", params: payload, headers: {
        "CONTENT_TYPE" => "application/json",
        "Chapa-Signature" => forged_signature
      }

      expect(response).to have_http_status(:unauthorized)
      body = JSON.parse(response.body)
      expect(body["error"]).to eq("Invalid signature")
    end

    it "rejects webhooks where gateway currency does not match ETB" do
      payload = {
        event: "charge.complete",
        tx_ref: purchase.processor_transaction_id,
        status: "success"
      }.to_json

      valid_signature = OpenSSL::HMAC.hexdigest("SHA256", secret_key, payload)

      allow_any_instance_of(Chapa::Client).to receive(:verify_transaction).with(purchase.processor_transaction_id).and_return({
                                                                                                                                success: true,
                                                                                                                                status: "success",
                                                                                                                                amount: 500.0,
                                                                                                                                currency: "USD",
                                                                                                                                reference: "chapa_ref_1"
                                                                                                                              })

      post "/webhooks/chapa", params: payload, headers: {
        "CONTENT_TYPE" => "application/json",
        "Chapa-Signature" => valid_signature
      }

      expect(response).to have_http_status(:unprocessable_content)
      body = JSON.parse(response.body)
      expect(body["error"]).to eq("Currency mismatch")
    end

    it "rejects webhooks where gateway amount does not match purchase price" do
      payload = {
        event: "charge.complete",
        tx_ref: purchase.processor_transaction_id,
        status: "success"
      }.to_json

      valid_signature = OpenSSL::HMAC.hexdigest("SHA256", secret_key, payload)

      # 10 ETB instead of expected 500 ETB (50000 santims)
      allow_any_instance_of(Chapa::Client).to receive(:verify_transaction).with(purchase.processor_transaction_id).and_return({
                                                                                                                                success: true,
                                                                                                                                status: "success",
                                                                                                                                amount: 10.0,
                                                                                                                                currency: "ETB",
                                                                                                                                reference: "chapa_ref_2"
                                                                                                                              })

      post "/webhooks/chapa", params: payload, headers: {
        "CONTENT_TYPE" => "application/json",
        "Chapa-Signature" => valid_signature
      }

      expect(response).to have_http_status(:unprocessable_content)
      body = JSON.parse(response.body)
      expect(body["error"]).to eq("Amount mismatch")
    end
  end
end
