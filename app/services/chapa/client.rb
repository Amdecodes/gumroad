# frozen_string_literal: true

require "faraday"
require "json"
require "openssl"

module Chapa
  class Client
    DEFAULT_API_BASE_URL = "https://api.chapa.co/v1"
    DEFAULT_TIMEOUT_SECONDS = 15

    attr_reader :secret_key, :public_key, :webhook_secret, :api_base_url

    def initialize(
      secret_key: nil,
      public_key: nil,
      webhook_secret: nil,
      api_base_url: nil
    )
      @secret_key = secret_key.presence ||
                    ENV["CHAPA_SECRET_KEY"].presence ||
                    Rails.application.credentials.dig(:chapa, :secret_key)
      @public_key = public_key.presence ||
                    ENV["CHAPA_PUBLIC_KEY"].presence ||
                    Rails.application.credentials.dig(:chapa, :public_key)
      @webhook_secret = webhook_secret.presence ||
                        ENV["CHAPA_WEBHOOK_SECRET"].presence ||
                        Rails.application.credentials.dig(:chapa, :webhook_secret) ||
                        @secret_key
      @api_base_url = api_base_url.presence ||
                      ENV["CHAPA_API_URL"].presence ||
                      DEFAULT_API_BASE_URL
    end

    # Initializes a Chapa transaction for a purchase.
    # Formats amount from integer santims (minor units) to decimal string (e.g. 25000 santims -> "250.00").
    # Generates collision-resistant tx_ref.
    def initialize_transaction(purchase:, return_url:, callback_url:)
      tx_ref = generate_tx_ref(purchase)
      amount_cents = purchase.respond_to?(:price_in_currency_cents) ? purchase.price_in_currency_cents : (purchase.displayed_price_cents.presence || purchase.price_cents)
      amount_decimal = sprintf("%.2f", amount_cents / 100.0)

      name_parts = (purchase.full_name.presence || "Customer").strip.split(/\s+/, 2)
      first_name = name_parts[0].presence || "Customer"
      last_name = name_parts[1].presence || "Customer"

      payload = {
        amount: amount_decimal,
        currency: "ETB",
        email: purchase.email,
        first_name:,
        last_name:,
        tx_ref:,
        callback_url:,
        return_url:,
        "customization[title]" => (purchase.link&.name.presence || "Product Purchase").truncate(50),
        "customization[description]" => "Order #{purchase.external_id}"
      }

      response = http_client.post("transaction/initialize") do |req|
        req.headers["Authorization"] = "Bearer #{secret_key}"
        req.headers["Content-Type"] = "application/json"
        req.body = payload.to_json
      end

      body = parse_json(response.body)

      if response.success? && body["status"] == "success"
        checkout_url = body.dig("data", "checkout_url")
        {
          success: true,
          tx_ref:,
          checkout_url:,
          raw: body
        }
      else
        error_msg = body["message"] || "Failed to initialize Chapa transaction (HTTP #{response.status})"
        {
          success: false,
          tx_ref:,
          error: error_msg,
          raw: body
        }
      end
    rescue Faraday::Error => e
      {
        success: false,
        tx_ref:,
        error: "Network error connecting to Chapa: #{e.message}"
      }
    end

    # Verifies a Chapa transaction by tx_ref server-to-server.
    def verify_transaction(tx_ref)
      return { success: false, error: "Missing tx_ref" } if tx_ref.blank?

      response = http_client.get("transaction/verify/#{CGI.escape(tx_ref.to_s)}") do |req|
        req.headers["Authorization"] = "Bearer #{secret_key}"
      end

      body = parse_json(response.body)

      if response.success? && body["status"] == "success"
        data = body["data"] || {}
        status = (data["status"] || body["status"]).to_s.downcase

        {
          success: status == "success",
          status:,
          amount: data["amount"],
          currency: data["currency"],
          reference: data["reference"],
          tx_ref: data["tx_ref"] || tx_ref,
          raw: body
        }
      else
        {
          success: false,
          status: body.dig("data", "status") || body["status"],
          error: body["message"] || "Failed to verify Chapa transaction (HTTP #{response.status})",
          raw: body
        }
      end
    rescue Faraday::Error => e
      {
        success: false,
        error: "Network error connecting to Chapa: #{e.message}"
      }
    end

    # Validates Chapa webhook signature computed via HMAC SHA256 of raw body with webhook secret.
    def valid_signature?(raw_body, signature_header)
      return false if raw_body.blank? || signature_header.blank? || webhook_secret.blank?

      expected_signature = OpenSSL::HMAC.hexdigest("SHA256", webhook_secret, raw_body)
      Rack::Utils.secure_compare(expected_signature, signature_header.to_s.strip)
    end

    def generate_tx_ref(purchase)
      "arifdrop-#{purchase.external_id}-#{SecureRandom.hex(4)}"
    end

    private
      def http_client
        @http_client ||= Faraday.new(url: api_base_url) do |f|
          f.request :json
          f.options.timeout = DEFAULT_TIMEOUT_SECONDS
          f.options.open_timeout = DEFAULT_TIMEOUT_SECONDS
          f.adapter Faraday.default_adapter
        end
      end

      def parse_json(raw)
        return {} if raw.blank?

        JSON.parse(raw)
      rescue JSON::ParserError
        { "message" => raw.to_s }
      end
  end
end
