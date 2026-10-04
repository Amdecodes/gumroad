# frozen_string_literal: true

require "spec_helper"

RSpec.describe "POST /webhooks/chapa (Subscription Renewal)" do
  let(:webhook_secret) { "TEST_CHAPA_WEBHOOK_SECRET_XYZ" }
  let(:seller) { create(:named_seller) }
  let(:subscriber) { create(:user) }
  let(:product) { create(:membership_product, subscription_duration: "monthly", user: seller, price_currency_type: "etb") }
  let(:subscription) { create(:subscription, link: product, user: subscriber) }

  let!(:original_purchase) do
    travel_to(Time.zone.parse("2026-10-01 12:00:00")) do
      create(
        :purchase,
        link: product,
        seller:,
        subscription:,
        is_original_subscription_purchase: true,
        purchase_state: "successful",
        succeeded_at: Time.current,
        price_cents: 25000,
        displayed_price_cents: 25000,
        displayed_price_currency_type: "etb"
      )
    end
  end

  let(:tx_ref) { "arifdrop-sub-renew-#{subscription.id}-abcd" }

  let!(:renewal_purchase) do
    travel_to(Time.zone.parse("2026-10-29 10:00:00")) do
      create(
        :purchase,
        link: product,
        seller:,
        subscription:,
        is_original_subscription_purchase: false,
        purchase_state: "in_progress",
        charge_processor_id: "chapa",
        stripe_transaction_id: tx_ref,
        processor_payment_intent_id: tx_ref,
        price_cents: 25000,
        displayed_price_cents: 25000,
        displayed_price_currency_type: "etb",
        email: subscriber.email
      )
    end
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

  context "when webhook is verified for subscription renewal" do
    before do
      stub_request(:get, "https://api.chapa.co/v1/transaction/verify/#{tx_ref}")
        .to_return(
          status: 200,
          headers: { "Content-Type" => "application/json" },
          body: {
            status: "success",
            data: {
              status: "success",
              amount: "250.00",
              currency: "ETB",
              reference: "CHAPA_REF_RENEW_123",
              tx_ref:
            }
          }.to_json
        )
    end

    it "advances subscription period, marks purchase successful, and records seller balance transaction" do
      payload = { event: "charge.complete", tx_ref: }.to_json
      signature = compute_signature(payload)

      expect do
        post "/webhooks/chapa", params: payload, headers: {
          "CONTENT_TYPE" => "application/json",
          "HTTP_CHAPA_SIGNATURE" => signature
        }
      end.to change { SendPurchaseReceiptJob.jobs.size }.by(1)
        .and change { BalanceTransaction.where(user: seller).count }.by(1)

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["status"]).to eq("success")

      renewal_purchase.reload
      expect(renewal_purchase.successful?).to be(true)
      expect(renewal_purchase.stripe_transaction_id).to eq("CHAPA_REF_RENEW_123")

      subscription.reload
      expected_end = Time.zone.parse("2026-12-01 12:00:00")
      expect(subscription.end_time_of_subscription).to eq(expected_end)
    end

    it "is idempotent on duplicate webhook deliveries" do
      payload = { event: "charge.complete", tx_ref: }.to_json
      signature = compute_signature(payload)

      # First delivery
      post "/webhooks/chapa", params: payload, headers: {
        "CONTENT_TYPE" => "application/json",
        "HTTP_CHAPA_SIGNATURE" => signature
      }
      expect(response).to have_http_status(:ok)
      first_end_time = subscription.reload.end_time_of_subscription
      first_tx_count = BalanceTransaction.where(user: seller).count

      # Duplicate delivery
      post "/webhooks/chapa", params: payload, headers: {
        "CONTENT_TYPE" => "application/json",
        "HTTP_CHAPA_SIGNATURE" => signature
      }
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["message"]).to eq("Purchase already finalized")

      expect(subscription.reload.end_time_of_subscription).to eq(first_end_time)
      expect(BalanceTransaction.where(user: seller).count).to eq(first_tx_count)
    end
  end
end
