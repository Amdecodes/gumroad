# frozen_string_literal: true

require "spec_helper"

RSpec.describe Chapa::Client do
  let(:secret_key) { "CHAPA_TEST_SECRET_KEY_12345" }
  let(:public_key) { "CHAPA_TEST_PUBLIC_KEY_12345" }
  let(:webhook_secret) { "CHAPA_TEST_WEBHOOK_SECRET_12345" }
  let(:client) { described_class.new(secret_key:, public_key:, webhook_secret:) }

  let(:seller) { create(:user) }
  let(:product) { create(:product, user: seller, price_currency_type: "etb") }
  let(:purchase) do
    create(
      :purchase,
      link: product,
      seller:,
      price_cents: 25000,
      displayed_price_currency_type: "etb",
      email: "buyer@example.com",
      full_name: "Abebe Bikila",
      purchase_state: "in_progress"
    )
  end

  describe "#initialize_transaction" do
    let(:return_url) { "https://example.com/purchases/123/chapa_callback" }
    let(:callback_url) { "https://example.com/webhooks/chapa" }

    it "formats integer santims to two-decimal string without float rounding loss" do
      hash_including(
        amount: "250.00",
        currency: "ETB",
        email: "buyer@example.com",
        first_name: "Abebe",
        last_name: "Bikila",
        return_url:,
        callback_url:
      )

      fake_response = instance_double(
        Faraday::Response,
        success?: true,
        status: 200,
        body: {
          status: "success",
          data: {
            checkout_url: "https://checkout.chapa.co/checkout/payment/123456789"
          }
        }.to_json
      )

      allow_any_instance_of(Faraday::Connection).to receive(:post)
        .with("transaction/initialize") do |&block|
          block&.call(double("req", headers: {}, :body= => nil))
          fake_response
        end

      result = client.initialize_transaction(purchase:, return_url:, callback_url:)

      expect(result[:success]).to be true
      expect(result[:checkout_url]).to eq("https://checkout.chapa.co/checkout/payment/123456789")
      expect(result[:tx_ref]).to start_with("arifdrop-#{purchase.external_id}-")
    end

    it "handles gateway failure responses gracefully" do
      fake_response = instance_double(
        Faraday::Response,
        success?: false,
        status: 400,
        body: {
          status: "failed",
          message: "Invalid email address"
        }.to_json
      )

      allow_any_instance_of(Faraday::Connection).to receive(:post)
        .with("transaction/initialize")
        .and_return(fake_response)

      result = client.initialize_transaction(purchase:, return_url:, callback_url:)

      expect(result[:success]).to be false
      expect(result[:error]).to eq("Invalid email address")
    end

    it "catches Faraday network errors without raising exceptions" do
      allow_any_instance_of(Faraday::Connection).to receive(:post)
        .with("transaction/initialize")
        .and_raise(Faraday::ConnectionFailed.new("Connection refused"))

      result = client.initialize_transaction(purchase:, return_url:, callback_url:)

      expect(result[:success]).to be false
      expect(result[:error]).to include("Network error connecting to Chapa")
    end
  end

  describe "#verify_transaction" do
    let(:tx_ref) { "arifdrop-test-tx-12345" }

    it "parses successful verification responses accurately" do
      fake_response = instance_double(
        Faraday::Response,
        success?: true,
        status: 200,
        body: {
          status: "success",
          data: {
            status: "success",
            amount: 250.00,
            currency: "ETB",
            reference: "CHAPA_REF_998877",
            tx_ref:
          }
        }.to_json
      )

      allow_any_instance_of(Faraday::Connection).to receive(:get)
        .with("transaction/verify/#{tx_ref}")
        .and_return(fake_response)

      result = client.verify_transaction(tx_ref)

      expect(result[:success]).to be true
      expect(result[:status]).to eq("success")
      expect(result[:amount]).to eq(250.00)
      expect(result[:currency]).to eq("ETB")
      expect(result[:reference]).to eq("CHAPA_REF_998877")
    end

    it "returns failure when verification status is not success" do
      fake_response = instance_double(
        Faraday::Response,
        success?: true,
        status: 200,
        body: {
          status: "success",
          data: {
            status: "pending",
            amount: 250.00,
            currency: "ETB",
            tx_ref:
          }
        }.to_json
      )

      allow_any_instance_of(Faraday::Connection).to receive(:get)
        .with("transaction/verify/#{tx_ref}")
        .and_return(fake_response)

      result = client.verify_transaction(tx_ref)

      expect(result[:success]).to be false
      expect(result[:status]).to eq("pending")
    end

    it "handles network timeouts gracefully" do
      allow_any_instance_of(Faraday::Connection).to receive(:get)
        .with("transaction/verify/#{tx_ref}")
        .and_raise(Faraday::TimeoutError.new("Execution expired"))

      result = client.verify_transaction(tx_ref)

      expect(result[:success]).to be false
      expect(result[:error]).to include("Network error connecting to Chapa")
    end
  end

  describe "#valid_signature?" do
    let(:raw_body) { '{"event":"charge.complete","tx_ref":"arifdrop-123"}' }

    it "validates authentic HMAC SHA256 signatures in constant time" do
      valid_sig = OpenSSL::HMAC.hexdigest("SHA256", webhook_secret, raw_body)
      expect(client.valid_signature?(raw_body, valid_sig)).to be true
    end

    it "rejects tampered or mismatched signatures" do
      invalid_sig = OpenSSL::HMAC.hexdigest("SHA256", "WRONG_SECRET", raw_body)
      expect(client.valid_signature?(raw_body, invalid_sig)).to be false
    end

    it "rejects empty or blank signatures and payloads" do
      expect(client.valid_signature?("", "some_sig")).to be false
      expect(client.valid_signature?(raw_body, "")).to be false
      expect(client.valid_signature?(nil, nil)).to be false
    end
  end
end
