# frozen_string_literal: true

require "digest"

module Webhooks
  class ChapaController < ApplicationController
    skip_before_action :verify_authenticity_token

    def create
      raw_body = request.raw_post
      signature = request.headers["x-chapa-signature"] ||
                  request.headers["chapa-signature"] ||
                  request.headers["Chapa-Signature"] ||
                  request.headers["HTTP_CHAPA_SIGNATURE"] ||
                  request.headers["HTTP_X_CHAPA_SIGNATURE"]

      client = Chapa::Client.new
      unless client.valid_signature?(raw_body, signature)
        Rails.logger.warn("[Chapa Webhook] Invalid signature received from IP #{request.remote_ip}")
        return render json: { error: "Invalid signature" }, status: :unauthorized
      end

      payload = parse_payload(raw_body)
      event_type = payload["event"] || payload["type"] || "transaction"
      tx_ref = payload["tx_ref"] || payload.dig("data", "tx_ref")

      # Generate collision-resistant unique idempotency key
      idempotency_key = payload["id"] ||
                        payload.dig("data", "id") ||
                        "#{event_type}_#{tx_ref}_#{Digest::SHA256.hexdigest(raw_body)}"

      event = ChapaWebhookEvent.find_or_create_by(idempotency_key:) do |e|
        e.event_type = event_type
        e.tx_ref = tx_ref
        e.raw_payload = raw_body
        e.status = "received"
      end

      if event.status == "processed"
        return render json: { status: "success", message: "Event already processed" }, status: :ok
      end

      # Return HTTP 200 fast, delegate heavy processing to asynchronous Sidekiq job
      Chapa::ProcessWebhookJob.perform_async(event.id)

      render json: { status: "success", message: "Webhook received" }, status: :ok
    end

    private
      def parse_payload(raw_body)
        return {} if raw_body.blank?

        JSON.parse(raw_body)
      rescue JSON::ParserError
        params.to_unsafe_h
      end
  end
end
