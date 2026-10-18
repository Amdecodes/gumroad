# frozen_string_literal: true

require "spec_helper"

RSpec.describe Chapa::Client do
  let(:secret_key) { "CHASECK_TEST-123456789" }
  let(:public_key) { "CHAPUBK_TEST-123456789" }
  let(:webhook_secret) { "WEBHOOK_HASH_SECRET_123" }
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
    let(:return_url) { "https://example.com/orders/123/return" }
    let(:callback_url) { "https://example.com/webhooks/chapa" }
    let(:endpoint) { "https://api.chapa.co/v1/transaction/initialize" }

    it "formats santims via Chapa::Money, normalizes phone, and truncates fields" do
      long_title = "A" * 100
      phone = "+251 91 123 4567" # Normalizes to 0911234567

      stub_request(:post, endpoint)
        .with do |req|
          payload = JSON.parse(req.body)
          expect(req.headers["Authorization"]).to eq("Bearer #{secret_key}")
          expect(payload["amount"]).to eq("250.00")
          expect(payload["currency"]).to eq("ETB")
          expect(payload["email"]).to eq("buyer@example.com")
          expect(payload["phone_number"]).to eq("0911234567")
          expect(payload["customization[title]"].length).to be <= 50
          expect(payload["customization[description]"].length).to be <= 255
          true
        end
        .to_return(
          status: 200,
          body: {
            status: "success",
            data: { checkout_url: "https://checkout.chapa.co/checkout/payment/12345" }
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      result = client.initialize_transaction(
        purchase:,
        return_url:,
        callback_url:,
        phone_number: phone,
        title: long_title
      )

      expect(result[:success]).to be true
      expect(result[:checkout_url]).to eq("https://checkout.chapa.co/checkout/payment/12345")
    end

    it "omits phone_number when invalid" do
      invalid_phone = "12345" # Not valid Ethiopian format

      stub_request(:post, endpoint)
        .with do |req|
          payload = JSON.parse(req.body)
          expect(payload).not_to have_key("phone_number")
          true
        end
        .to_return(
          status: 200,
          body: { status: "success", data: { checkout_url: "https://checkout.chapa.co" } }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      result = client.initialize_transaction(
        purchase:,
        return_url:,
        callback_url:,
        phone_number: invalid_phone
      )

      expect(result[:success]).to be true
    end

    it "handles gateway failure responses gracefully with error mapping" do
      stub_request(:post, endpoint)
        .to_return(
          status: 400,
          body: {
            status: "failed",
            message: "Transaction reference has been used before"
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      result = client.initialize_transaction(purchase:, return_url:, callback_url:)

      expect(result[:success]).to be false
      expect(result[:error_code]).to eq("Transaction reference has been used before")
      expect(result[:error]).to include("already been used")
    end

    it "catches Faraday network errors without raising exceptions" do
      stub_request(:post, endpoint)
        .to_timeout

      result = client.initialize_transaction(purchase:, return_url:, callback_url:)

      expect(result[:success]).to be false
      expect(result[:error]).to include("Network error connecting to payment gateway")
    end
  end

  describe "#verify_transaction" do
    let(:tx_ref) { "arifdrop-test-12345" }
    let(:endpoint) { "https://api.chapa.co/v1/transaction/verify/#{tx_ref}" }

    it "parses successful verification responses including charge and mode" do
      stub_request(:get, endpoint)
        .with(headers: { "Authorization" => "Bearer #{secret_key}" })
        .to_return(
          status: 200,
          body: {
            status: "success",
            data: {
              status: "success",
              amount: 250.00,
              currency: "ETB",
              reference: "CHAPA_REF_998877",
              tx_ref:,
              charge: 3.50,
              mode: "test",
              payment_method: "telebirr"
            }
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      result = client.verify_transaction(tx_ref)

      expect(result[:success]).to be true
      expect(result[:status]).to eq("success")
      expect(result[:amount]).to eq(250.00)
      expect(result[:currency]).to eq("ETB")
      expect(result[:charge]).to eq(3.50)
      expect(result[:mode]).to eq("test")
      expect(result[:payment_method]).to eq("telebirr")
    end

    it "retries safe GETs on transient 5xx errors" do
      stub_request(:get, endpoint)
        .to_return(status: 502, body: "Bad Gateway")
        .then
        .to_return(
          status: 200,
          body: { status: "success", data: { status: "success", tx_ref: } }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      result = client.verify_transaction(tx_ref)
      expect(result[:success]).to be true
      expect(a_request(:get, endpoint)).to have_been_made.twice
    end
  end

  describe "#refund_transaction" do
    let(:tx_ref) { "arifdrop-test-12345" }
    let(:endpoint) { "https://api.chapa.co/v1/refund/#{tx_ref}" }

    it "initiates refund via POST and returns ref_id" do
      stub_request(:post, endpoint)
        .to_return(
          status: 200,
          body: {
            message: "Refund initiated successfully",
            status: "success",
            data: {
              ref_id: "REF-12345-ABC",
              status: "initiated",
              amount: 100.00,
              currency: "ETB"
            }
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      result = client.refund_transaction(tx_ref:, amount_santims: 10000, reason: "Customer return")

      expect(result[:success]).to be true
      expect(result[:ref_id]).to eq("REF-12345-ABC")
      expect(result[:status]).to eq("initiated")
    end

    it "maps Insufficient Balance error properly" do
      stub_request(:post, endpoint)
        .to_return(
          status: 400,
          body: {
            status: "failed",
            message: "Insufficient Balance"
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      result = client.refund_transaction(tx_ref:)

      expect(result[:success]).to be false
      expect(result[:error_code]).to eq("Insufficient Balance")
      expect(result[:error]).to include("Insufficient account balance")
    end
  end

  describe "#verify_refund" do
    let(:ref_id) { "REF-12345-ABC" }
    let(:endpoint) { "https://api.chapa.co/v1/refund/#{ref_id}/verify" }

    it "checks refund status via GET" do
      stub_request(:get, endpoint)
        .to_return(
          status: 200,
          body: {
            status: "success",
            data: {
              ref_id:,
              status: "refunded",
              amount: 100.00,
              currency: "ETB",
              payment_reference: "CGRMuqd8EC"
            }
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      result = client.verify_refund(ref_id)

      expect(result[:success]).to be true
      expect(result[:status]).to eq("refunded")
      expect(result[:payment_reference]).to eq("CGRMuqd8EC")
    end
  end

  describe "#valid_signature?" do
    let(:raw_body) { '{"event":"charge.complete","tx_ref":"arifdrop-123"}' }

    it "validates signatures using dashboard webhook_secret" do
      sig = OpenSSL::HMAC.hexdigest("SHA256", webhook_secret, raw_body)
      expect(client.valid_signature?(raw_body, sig)).to be true
    end

    it "falls back to validating against API secret_key" do
      sig = OpenSSL::HMAC.hexdigest("SHA256", secret_key, raw_body)
      expect(client.valid_signature?(raw_body, sig)).to be true
    end

    it "rejects tampered signatures" do
      invalid_sig = OpenSSL::HMAC.hexdigest("SHA256", "completely_wrong_key", raw_body)
      expect(client.valid_signature?(raw_body, invalid_sig)).to be false
    end

    it "rejects blank signatures or payloads" do
      expect(client.valid_signature?("", "some_sig")).to be false
      expect(client.valid_signature?(raw_body, "")).to be false
      expect(client.valid_signature?(nil, nil)).to be false
    end
  end

  describe "#normalize_phone_number" do
    it "normalizes Ethiopian formats to 10 digits" do
      expect(client.normalize_phone_number("0911223344")).to eq("0911223344")
      expect(client.normalize_phone_number("+251911223344")).to eq("0911223344")
      expect(client.normalize_phone_number("251711223344")).to eq("0711223344")
      expect(client.normalize_phone_number("911223344")).to eq("0911223344")
      expect(client.normalize_phone_number("0711223344")).to eq("0711223344")
    end

    it "returns nil for non-Ethiopian or invalid numbers" do
      expect(client.normalize_phone_number("12345")).to be_nil
      expect(client.normalize_phone_number("+12025550123")).to be_nil
      expect(client.normalize_phone_number("")).to be_nil
      expect(client.normalize_phone_number(nil)).to be_nil
    end
  end
end
