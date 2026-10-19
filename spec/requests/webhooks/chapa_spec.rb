# frozen_string_literal: true

require "spec_helper"

describe "Chapa Webhooks", type: :request do
  let(:secret_key) { "CHASECK_TEST-abcdef123456" }
  let(:webhook_secret) { "test_webhook_secret_hash_987" }
  let(:raw_payload) do
    {
      event: "charge.complete",
      tx_ref: "chk_test_webhook_1234",
      reference: "chp_ref_789",
      amount: "100.00",
      currency: "ETB",
      status: "success"
    }.to_json
  end

  let(:headers) do
    {
      "CONTENT_TYPE" => "application/json",
      "HOST" => VALID_REQUEST_HOSTS.first
    }
  end

  before do
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with("CHAPA_SECRET_KEY").and_return(secret_key)
    allow(ENV).to receive(:[]).with("CHAPA_WEBHOOK_SECRET").and_return(webhook_secret)
  end

  describe "POST /webhooks/chapa" do
    context "with valid signature computed from webhook_secret" do
      let(:signature) { OpenSSL::HMAC.hexdigest("SHA256", webhook_secret, raw_payload) }

      it "verifies raw body signature, persists event and dispatches background job" do
        expect do
          post "/webhooks/chapa",
               params: raw_payload,
               headers: headers.merge("HTTP_X_CHAPA_SIGNATURE" => signature)
        end.to change(ChapaWebhookEvent, :count).by(1)
           .and change(Chapa::ProcessWebhookJob.jobs, :size).by(1)

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json["status"]).to eq("success")

        event = ChapaWebhookEvent.last
        expect(event.tx_ref).to eq("chk_test_webhook_1234")
        expect(event.event_type).to eq("charge.complete")
      end

      it "accepts chapa-signature header variant" do
        post "/webhooks/chapa",
             params: raw_payload,
             headers: headers.merge("HTTP_CHAPA_SIGNATURE" => signature)

        expect(response).to have_http_status(:ok)
      end
    end

    context "with valid signature fallback to secret_key" do
      let(:signature) { OpenSSL::HMAC.hexdigest("SHA256", secret_key, raw_payload) }

      it "authenticates successfully when signed with API secret key" do
        post "/webhooks/chapa",
             params: raw_payload,
             headers: headers.merge("HTTP_X_CHAPA_SIGNATURE" => signature)

        expect(response).to have_http_status(:ok)
      end
    end

    context "with invalid signature" do
      it "rejects request with 401 unauthorized" do
        expect do
          post "/webhooks/chapa",
               params: raw_payload,
               headers: headers.merge("HTTP_X_CHAPA_SIGNATURE" => "invalid_signature_hash")
        end.not_to change(ChapaWebhookEvent, :count)

        expect(response).to have_http_status(:unauthorized)
        json = JSON.parse(response.body)
        expect(json["error"]).to eq("Invalid signature")
      end
    end

    context "with missing signature" do
      it "rejects request with 401 unauthorized" do
        post "/webhooks/chapa",
             params: raw_payload,
             headers: headers

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "when webhook is a duplicate that has already been processed" do
      let(:signature) { OpenSSL::HMAC.hexdigest("SHA256", webhook_secret, raw_payload) }

      before do
        idempotency_key = "charge.complete_chk_test_webhook_1234_#{Digest::SHA256.hexdigest(raw_payload)}"
        ChapaWebhookEvent.create!(
          idempotency_key:,
          event_type: "charge.complete",
          tx_ref: "chk_test_webhook_1234",
          raw_payload:,
          status: "processed"
        )
      end

      it "returns 200 ok fast without re-enqueuing job" do
        expect do
          post "/webhooks/chapa",
               params: raw_payload,
               headers: headers.merge("HTTP_X_CHAPA_SIGNATURE" => signature)
        end.not_to change(Chapa::ProcessWebhookJob.jobs, :size)

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json["message"]).to include("already processed")
      end
    end

    context "with documented Chapa payload variants" do
      it "accepts charge.refunded payload and enqueues job" do
        payload = {
          event: "charge.refunded",
          currency: "ETB",
          amount: "400.00",
          charge: "12.00",
          status: "refunded",
          mode: "live",
          reference: "AP634JFwEbxd",
          tx_ref: "4FGFF4FFGD3"
        }.to_json
        sig = OpenSSL::HMAC.hexdigest("SHA256", webhook_secret, payload)

        expect do
          post "/webhooks/chapa",
               params: payload,
               headers: headers.merge("HTTP_X_CHAPA_SIGNATURE" => sig)
        end.to change(Chapa::ProcessWebhookJob.jobs, :size).by(1)

        expect(response).to have_http_status(:ok)
        event = ChapaWebhookEvent.last
        expect(event.event_type).to eq("charge.refunded")
        expect(event.tx_ref).to eq("4FGFF4FFGD3")
      end

      it "accepts charge.reversed payload and enqueues job" do
        payload = {
          event: "charge.reversed",
          status: "reversed",
          reference: "AP634JFwEbxd",
          tx_ref: "4FGFF4FFGD3"
        }.to_json
        sig = OpenSSL::HMAC.hexdigest("SHA256", webhook_secret, payload)

        expect do
          post "/webhooks/chapa",
               params: payload,
               headers: headers.merge("HTTP_X_CHAPA_SIGNATURE" => sig)
        end.to change(Chapa::ProcessWebhookJob.jobs, :size).by(1)

        expect(response).to have_http_status(:ok)
      end

      it "accepts charge.failed/cancelled payload and enqueues job" do
        payload = {
          event: "charge.failed/cancelled",
          status: "failed",
          reference: "AP634JFwEbxd",
          tx_ref: "4FGFF4FFGD3"
        }.to_json
        sig = OpenSSL::HMAC.hexdigest("SHA256", webhook_secret, payload)

        expect do
          post "/webhooks/chapa",
               params: payload,
               headers: headers.merge("HTTP_X_CHAPA_SIGNATURE" => sig)
        end.to change(Chapa::ProcessWebhookJob.jobs, :size).by(1)

        expect(response).to have_http_status(:ok)
      end

      it "accepts unknown event payload, returns 200 and enqueues job" do
        payload = {
          event: "custom.unknown_event",
          status: "unsupported",
          reference: "MYMER3434989"
        }.to_json
        sig = OpenSSL::HMAC.hexdigest("SHA256", webhook_secret, payload)

        expect do
          post "/webhooks/chapa",
               params: payload,
               headers: headers.merge("HTTP_X_CHAPA_SIGNATURE" => sig)
        end.to change(Chapa::ProcessWebhookJob.jobs, :size).by(1)

        expect(response).to have_http_status(:ok)
      end
    end
  end
end
