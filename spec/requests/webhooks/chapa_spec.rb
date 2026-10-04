# frozen_string_literal: true

require "spec_helper"

RSpec.describe "POST /webhooks/chapa" do
  let(:webhook_secret) { "TEST_CHAPA_WEBHOOK_SECRET_XYZ" }
  let(:seller) { create(:user) }
  let(:product) { create(:product, user: seller, price_currency_type: "etb") }
  let(:tx_ref) { "arifdrop-test-purchase-9988" }
  let(:order) { create(:order) }
  let!(:purchase) do
    create(
      :purchase,
      link: product,
      seller:,
      price_cents: 25000,
      displayed_price_cents: 25000,
      displayed_price_currency_type: "etb",
      email: "buyer@example.com",
      purchase_state: "in_progress",
      charge_processor_id: "chapa",
      processor_payment_intent_id: tx_ref,
      stripe_transaction_id: tx_ref,
      order:
    )
  end

  before do
    host! DOMAIN
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with("CHAPA_WEBHOOK_SECRET").and_return(webhook_secret)
    allow(ENV).to receive(:[]).with("CHAPA_SECRET_KEY").and_return("TEST_SECRET_KEY")
  end

  def compute_signature(body, secret = webhook_secret)
    OpenSSL::HMAC.hexdigest("SHA256", secret, body)
  end

  context "when signature is invalid" do
    it "returns 401 Unauthorized and does not alter purchase state" do
      payload = { event: "charge.complete", tx_ref: purchase.processor_transaction_id }.to_json
      invalid_sig = compute_signature(payload, "WRONG_SECRET")

      post "/webhooks/chapa", params: payload, headers: {
        "CONTENT_TYPE" => "application/json",
        "HTTP_CHAPA_SIGNATURE" => invalid_sig
      }

      expect(response).to have_http_status(:unauthorized)
      expect(JSON.parse(response.body)["error"]).to eq("Invalid signature")
      expect(purchase.reload.purchase_state).to eq("in_progress")
    end
  end

  context "when purchase cannot be found" do
    it "returns 404 Not Found" do
      payload = { event: "charge.complete", tx_ref: "non-existent-tx-ref" }.to_json
      sig = compute_signature(payload)

      post "/webhooks/chapa", params: payload, headers: {
        "CONTENT_TYPE" => "application/json",
        "HTTP_CHAPA_SIGNATURE" => sig
      }

      expect(response).to have_http_status(:not_found)
      expect(JSON.parse(response.body)["error"]).to eq("Purchase not found")
    end
  end

  context "when webhook signature is valid" do
    let(:payload) { { event: "charge.complete", tx_ref: }.to_json }
    let(:sig) { compute_signature(payload) }

    it "validates with Chapa API server-to-server and finalizes the purchase" do
      allow_any_instance_of(Chapa::Client).to receive(:verify_transaction)
        .with(tx_ref)
        .and_return({
                      success: true,
                      status: "success",
                      amount: 250.00,
                      currency: "ETB",
                      reference: "CHAPA_TRANS_776655",
                      tx_ref:
                    })

      expect do
        post "/webhooks/chapa", params: payload, headers: {
          "CONTENT_TYPE" => "application/json",
          "HTTP_CHAPA_SIGNATURE" => sig
        }
      end.to change { purchase.reload.purchase_state }.from("in_progress").to("successful")

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["status"]).to eq("success")
      expect(purchase.reload.stripe_transaction_id).to eq("CHAPA_TRANS_776655")
      expect(purchase.charge_processor_id).to eq("chapa")
    end

    it "rejects when gateway verification reports amount mismatch" do
      allow_any_instance_of(Chapa::Client).to receive(:verify_transaction)
        .with(tx_ref)
        .and_return({
                      success: true,
                      status: "success",
                      amount: 100.00, # Only 100 ETB instead of 250 ETB
                      currency: "ETB",
                      reference: "CHAPA_TRANS_776655",
                      tx_ref:
                    })

      post "/webhooks/chapa", params: payload, headers: {
        "CONTENT_TYPE" => "application/json",
        "HTTP_CHAPA_SIGNATURE" => sig
      }

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body)["error"]).to eq("Amount mismatch")
      expect(purchase.reload.purchase_state).to eq("in_progress")
    end

    it "rejects when gateway verification reports currency mismatch" do
      allow_any_instance_of(Chapa::Client).to receive(:verify_transaction)
        .with(tx_ref)
        .and_return({
                      success: true,
                      status: "success",
                      amount: 250.00,
                      currency: "USD", # Mismatch!
                      reference: "CHAPA_TRANS_776655",
                      tx_ref:
                    })

      post "/webhooks/chapa", params: payload, headers: {
        "CONTENT_TYPE" => "application/json",
        "HTTP_CHAPA_SIGNATURE" => sig
      }

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body)["error"]).to eq("Currency mismatch")
      expect(purchase.reload.purchase_state).to eq("in_progress")
    end

    it "is idempotent and does not duplicate financial effects on retried callbacks" do
      # Pre-finalize purchase
      purchase.update_columns(purchase_state: "successful")

      expect_any_instance_of(Chapa::Client).not_to receive(:verify_transaction)
      expect_any_instance_of(Purchase).not_to receive(:increment_sellers_balance!)

      post "/webhooks/chapa", params: payload, headers: {
        "CONTENT_TYPE" => "application/json",
        "HTTP_CHAPA_SIGNATURE" => sig
      }

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["message"]).to eq("Purchase already finalized")
    end
  end
end
