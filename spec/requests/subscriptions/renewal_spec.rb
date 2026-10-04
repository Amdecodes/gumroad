# frozen_string_literal: true

require "spec_helper"

RSpec.describe "POST /subscriptions/:id/renew" do
  let(:seller) { create(:named_seller) }
  let(:subscriber) { create(:user) }
  let(:product) { create(:membership_product, subscription_duration: "monthly", user: seller, price_currency_type: "etb") }
  let(:subscription) { create(:subscription, link: product, user: subscriber) }

  let!(:original_purchase) do
    create(
      :purchase,
      link: product,
      seller:,
      subscription:,
      is_original_subscription_purchase: true,
      purchase_state: "successful",
      succeeded_at: 1.month.ago,
      price_cents: 25000,
      displayed_price_cents: 25000,
      displayed_price_currency_type: "etb"
    )
  end

  before do
    host! DOMAIN
    allow_any_instance_of(Chapa::Client).to receive(:initialize_transaction)
      .and_return({
                    success: true,
                    tx_ref: "arifdrop-sub-renew-#{subscription.id}-test",
                    checkout_url: "https://checkout.chapa.co/checkout/payment/123456"
                  })
  end

  context "when authorized with valid subscription token" do
    before do
      subscription.update!(token: "valid_token_123", token_expires_at: 1.day.from_now)
    end

    it "creates a pending renewal purchase in ETB santims and redirects to Chapa checkout" do
      expect do
        post "/subscriptions/#{subscription.external_id}/renew", params: { token: "valid_token_123" }
      end.to change(Purchase, :count).by(1)

      expect(response).to redirect_to("https://checkout.chapa.co/checkout/payment/123456")

      renewal = Purchase.last
      expect(renewal.subscription).to eq(subscription)
      expect(renewal.charge_processor_id).to eq("chapa")
      expect(renewal.displayed_price_currency_type.to_s).to eq("etb")
      expect(renewal.price_cents).to eq(25000)
      expect(renewal.displayed_price_cents).to eq(25000)
      expect(renewal.is_recurring_subscription_charge).to be(true)
      expect(renewal.in_progress?).to be(true)
    end

    it "returns JSON payload with checkout_url when requested via JSON" do
      post "/subscriptions/#{subscription.external_id}/renew",
           params: { token: "valid_token_123" },
           headers: { "ACCEPT" => "application/json" }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["success"]).to be(true)
      expect(json["checkout_url"]).to eq("https://checkout.chapa.co/checkout/payment/123456")
      expect(json["tx_ref"]).to be_present
    end

    it "rejects renewal when seller is suspended" do
      seller.update_column(:user_risk_state, "suspended_for_fraud")

      post "/subscriptions/#{subscription.external_id}/renew",
           params: { token: "valid_token_123" },
           headers: { "ACCEPT" => "application/json" }

      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json["error"]).to eq("Seller account is suspended")
    end

    it "handles Chapa gateway initialization errors gracefully" do
      allow_any_instance_of(Chapa::Client).to receive(:initialize_transaction)
        .and_return({
                      success: false,
                      error: "Chapa service temporarily unavailable"
                    })

      post "/subscriptions/#{subscription.external_id}/renew",
           params: { token: "valid_token_123" },
           headers: { "ACCEPT" => "application/json" }

      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json["success"]).to be(false)
      expect(json["error"]).to eq("Chapa service temporarily unavailable")
    end
  end

  context "when unauthorized without token or cookie" do
    it "redirects to magic link page" do
      post "/subscriptions/#{subscription.external_id}/renew"
      expect(response).to redirect_to(new_subscription_magic_link_path(subscription.external_id))
    end
  end
end
