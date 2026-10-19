# frozen_string_literal: true

require "faraday"
require "json"
require "openssl"

module Chapa
  class Client
    DEFAULT_API_BASE_URL = "https://api.chapa.co/v1"
    DEFAULT_TIMEOUT_SECONDS = 15
    DEFAULT_OPEN_TIMEOUT_SECONDS = 5
    MAX_GET_RETRIES = 2

    # Chapa documented field limits
    MAX_TITLE_LENGTH = 50
    MAX_DESCRIPTION_LENGTH = 255
    MAX_TX_REF_LENGTH = 100
    MAX_NAME_LENGTH = 100

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
                        Rails.application.credentials.dig(:chapa, :webhook_secret)
      @api_base_url = api_base_url.presence ||
                      ENV["CHAPA_API_URL"].presence ||
                      DEFAULT_API_BASE_URL
    end

    def test_mode?
      secret_key.to_s.start_with?("CHASECK_TEST")
    end

    # Initializes a Chapa checkout session.
    # Accepts either an Order, Purchase, or explicit fields.
    # Uses Chapa::Money to convert santims to birr decimal string without float arithmetic.
    # Never retries on POST failures.
    def initialize_transaction(
      amount_santims: nil,
      purchase: nil,
      order: nil,
      email: nil,
      first_name: nil,
      last_name: nil,
      phone_number: nil,
      return_url: nil,
      callback_url: nil,
      tx_ref: nil,
      title: nil,
      description: nil
    )
      # Resolve amount in santims
      santims = amount_santims ||
                order&.total_price_cents ||
                (purchase.respond_to?(:price_in_currency_cents) ? purchase.price_in_currency_cents : purchase&.price_cents) ||
                0

      amount_str = Money.santims_to_birr_string(santims)
      resolved_email = email.presence || order&.email.presence || purchase&.email.presence

      # Name resolution
      full_name = "#{first_name} #{last_name}".strip.presence ||
                  order&.full_name.presence ||
                  purchase&.full_name.presence ||
                  "Customer"
      name_parts = full_name.split(/\s+/, 2)
      f_name = (first_name.presence || name_parts[0].presence || "Customer").truncate(MAX_NAME_LENGTH)
      l_name = (last_name.presence || name_parts[1].presence || "Customer").truncate(MAX_NAME_LENGTH)

      # Transaction reference
      tx_ref = (tx_ref.presence || generate_tx_ref(order || purchase)).truncate(MAX_TX_REF_LENGTH)

      # Customization
      title = (title.presence || order&.line_items_summary.presence || purchase&.link&.name.presence || "Product Purchase").truncate(MAX_TITLE_LENGTH)
      description = (description.presence || "Order #{order&.external_id || purchase&.external_id}").truncate(MAX_DESCRIPTION_LENGTH)

      payload = {
        amount: amount_str,
        currency: "ETB",
        email: resolved_email,
        first_name: f_name,
        last_name: l_name,
        tx_ref:,
        callback_url:,
        return_url:,
        "customization[title]" => title,
        "customization[description]" => description
      }

      # Add normalized phone number if present and valid
      raw_phone = phone_number.presence ||
                  (order.respond_to?(:phone_number) ? order.phone_number.presence : nil) ||
                  (purchase.respond_to?(:phone_number) ? purchase.phone_number.presence : nil)
      normalized_phone = normalize_phone_number(raw_phone)
      payload[:phone_number] = normalized_phone if normalized_phone.present?

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
        mapped_error = map_error_message(error_msg)
        {
          success: false,
          tx_ref:,
          error: mapped_error,
          error_code: body["message"],
          raw: body
        }
      end
    rescue Faraday::Error => e
      log_safe_error("transaction/initialize", e)
      {
        success: false,
        tx_ref:,
        error: I18n.t("chapa.errors.network_error", default: "Network error connecting to payment gateway: %{msg}", msg: e.message)
      }
    end

    # Verifies a transaction by tx_ref.
    # Safe GET endpoint with automatic retries for transient connection errors.
    def verify_transaction(tx_ref)
      return { success: false, error: "Missing tx_ref" } if tx_ref.blank?

      response = execute_with_get_retry do
        http_client.get("transaction/verify/#{CGI.escape(tx_ref.to_s)}") do |req|
          req.headers["Authorization"] = "Bearer #{secret_key}"
        end
      end

      body = parse_json(response.body)

      if response.success? && %w[success refunded].include?(body["status"].to_s.downcase)
        data = body["data"] || {}
        status = (data["status"] || body["status"]).to_s.downcase

        {
          success: %w[success refunded].include?(status),
          status:,
          amount: data["amount"],
          currency: data["currency"],
          reference: data["reference"],
          tx_ref: data["tx_ref"] || tx_ref,
          mode: data["mode"] || (test_mode? ? "test" : "live"),
          charge: data["charge"],
          payment_method: data["payment_method"] || data["method"],
          raw: body
        }
      else
        error_msg = body["message"] || "Failed to verify Chapa transaction (HTTP #{response.status})"
        {
          success: false,
          status: body.dig("data", "status") || body["status"] || "failed",
          error: map_error_message(error_msg),
          error_code: body["message"],
          raw: body
        }
      end
    rescue Faraday::Error => e
      log_safe_error("transaction/verify", e)
      {
        success: false,
        status: "error",
        error: I18n.t("chapa.errors.network_error", default: "Network error connecting to payment gateway: %{msg}", msg: e.message)
      }
    end

    # Cancels an active transaction by tx_ref via PUT /v1/transaction/cancel/<tx_ref>.
    def cancel_transaction(tx_ref)
      return { success: false, error: "Missing tx_ref" } if tx_ref.blank?

      response = http_client.put("transaction/cancel/#{CGI.escape(tx_ref.to_s)}") do |req|
        req.headers["Authorization"] = "Bearer #{secret_key}"
      end

      body = parse_json(response.body)

      {
        success: response.success? && body["status"] == "success",
        status: body["status"],
        message: body["message"],
        raw: body
      }
    rescue Faraday::Error => e
      log_safe_error("transaction/cancel", e)
      {
        success: false,
        error: I18n.t("chapa.errors.network_error", default: "Network error connecting to payment gateway: %{msg}", msg: e.message)
      }
    end

    # Initiates a full or partial refund via POST /v1/refund/<identifier>.
    # Tries primary identifier (Chapa reference) first; falls back once to fallback_identifier (tx_ref)
    # if Chapa returns a 404 / not found response.
    # Never retries on non-idempotent POST failures (like timeouts or validation errors).
    def refund_transaction(identifier: nil, fallback_identifier: nil, tx_ref: nil, amount_santims: nil, reason: nil, reference: nil)
      primary_id = identifier.presence || tx_ref
      return { success: false, error: "Missing refund identifier" } if primary_id.blank?

      payload = {}
      if amount_santims.present? && amount_santims > 0
        payload[:amount] = Money.santims_to_birr_string(amount_santims)
      end
      payload[:reason] = reason.truncate(255) if reason.present?
      payload[:reference] = reference.truncate(100) if reference.present?

      result = attempt_refund_post(primary_id, payload)

      # Fallback to secondary identifier once if primary was not found
      if !result[:success] && fallback_identifier.present? && fallback_identifier.to_s != primary_id.to_s && not_found_response?(result)
        Rails.logger.warn("[Chapa::Client refund] Primary identifier '#{primary_id}' not found. Retrying once with fallback identifier '#{fallback_identifier}'.")
        result = attempt_refund_post(fallback_identifier, payload)
      end

      result
    end

    # Verifies a refund by ref_id via GET /v1/refund/<ref_id>/verify.
    # Safe GET endpoint with automatic retries for transient connection errors.
    def verify_refund(ref_id)
      return { success: false, error: "Missing ref_id" } if ref_id.blank?

      response = execute_with_get_retry do
        http_client.get("refund/#{CGI.escape(ref_id.to_s)}/verify") do |req|
          req.headers["Authorization"] = "Bearer #{secret_key}"
        end
      end

      body = parse_json(response.body)

      if response.success? && body["status"] == "success"
        data = body["data"] || {}
        status = (data["status"] || body["status"]).to_s.downcase

        {
          success: true,
          status:,
          amount: data["amount"],
          currency: data["currency"],
          ref_id: data["ref_id"] || ref_id,
          payment_reference: data["payment_reference"],
          raw: body
        }
      else
        error_msg = body["message"] || "Failed to verify refund (HTTP #{response.status})"
        {
          success: false,
          status: body.dig("data", "status") || "failed",
          error: map_error_message(error_msg),
          error_code: body["message"],
          raw: body
        }
      end
    rescue Faraday::Error => e
      log_safe_error("refund/verify", e)
      {
        success: false,
        status: "error",
        error: I18n.t("chapa.errors.network_error", default: "Network error connecting to payment gateway: %{msg}", msg: e.message)
      }
    end

    # Validates Chapa webhook signature computed via HMAC SHA256 of raw body.
    # Supports dual-key fallback: validates against webhook_secret first; falls back to secret_key.
    # Uses constant-time comparison to prevent timing attacks.
    def valid_signature?(raw_body, signature_header)
      return false if raw_body.blank? || signature_header.blank?

      sig_candidate = signature_header.to_s.strip

      # Check against webhook_secret (dashboard secret hash)
      if webhook_secret.present?
        expected_sig = OpenSSL::HMAC.hexdigest("SHA256", webhook_secret, raw_body)
        return true if Rack::Utils.secure_compare(expected_sig, sig_candidate)
      end

      # Fallback check against secret_key (API secret key)
      if secret_key.present?
        expected_key_sig = OpenSSL::HMAC.hexdigest("SHA256", secret_key, raw_body)
        return true if Rack::Utils.secure_compare(expected_key_sig, sig_candidate)
      end

      false
    end

    def generate_tx_ref(record = nil)
      prefix = if record.respond_to?(:external_id) && record.external_id.present?
        record.external_id
      elsif record.respond_to?(:id) && record.id.present?
        record.id.to_s
      else
        "cart"
      end
      "arifdrop-#{prefix}-#{SecureRandom.hex(6)}"
    end

    # Normalizes phone numbers to documented 10-digit 09xxxxxxxx or 07xxxxxxxx Ethiopian format.
    # Returns nil if phone is blank or cannot be normalized to a valid Ethiopian mobile number.
    def normalize_phone_number(phone)
      return nil if phone.blank?

      digits = phone.to_s.gsub(/\D/, "")
      if digits.start_with?("251") && digits.length == 12
        digits = "0#{digits[3..]}"
      elsif digits.length == 9 && (digits.start_with?("9") || digits.start_with?("7"))
        digits = "0#{digits}"
      end

      return digits if /\A(09|07)\d{8}\z/.match?(digits)

      nil
    end

    # Maps upstream Chapa gateway error messages to localized strings.
    def map_error_message(msg)
      return I18n.t("chapa.errors.generic_failure", default: "Payment failed. Please try again.") if msg.blank?

      lower = msg.to_s.downcase

      if lower.include?("insufficient balance") || lower.include?("insufficient funds")
        I18n.t("chapa.errors.insufficient_funds", default: "Insufficient account balance to complete the transaction.")
      elsif lower.include?("used before") || lower.include?("duplicate")
        I18n.t("chapa.errors.duplicate_ref", default: "This transaction reference has already been used.")
      elsif lower.include?("can't receive payments") || lower.include?("disabled")
        I18n.t("chapa.errors.merchant_disabled", default: "Merchant payments are currently disabled.")
      elsif lower.include?("declined") || lower.include?("cancelled")
        I18n.t("chapa.errors.payment_declined", default: "The payment was declined or cancelled. Please try again.")
      else
        msg
      end
    end

    private
      def http_client
        @http_client ||= Faraday.new(url: api_base_url) do |f|
          f.options.timeout = DEFAULT_TIMEOUT_SECONDS
          f.options.open_timeout = DEFAULT_OPEN_TIMEOUT_SECONDS
          f.adapter Faraday.default_adapter
        end
      end

      def execute_with_get_retry(&block)
        retries = 0
        loop do
          response = block.call
          if response.status >= 500 && retries < MAX_GET_RETRIES
            retries += 1
            sleep(0.2 * retries)
            next
          end
          return response
        rescue Faraday::ConnectionFailed, Faraday::TimeoutError => e
          if retries < MAX_GET_RETRIES
            retries += 1
            sleep(0.2 * retries)
            next
          end
          raise e
        end
      end

      def not_found_response?(result)
        return true if result[:status_code] == 404

        raw_str = "#{result[:error_code]} #{result[:error]} #{result[:raw]}".downcase
        raw_str.include?("not found") ||
          raw_str.include?("cannot be found") ||
          raw_str.include?("record not found") ||
          raw_str.include?("transaction not found") ||
          raw_str.include?("invalid transaction") ||
          raw_str.include?("does not exist") ||
          raw_str.include?("doesn't exist")
      end

      def attempt_refund_post(id, payload)
        response = http_client.post("refund/#{CGI.escape(id.to_s)}") do |req|
          req.headers["Authorization"] = "Bearer #{secret_key}"
          req.headers["Content-Type"] = "application/json"
          req.body = payload.to_json
        end

        body = parse_json(response.body)

        if response.success? && body["status"] == "success"
          data = body["data"] || {}
          {
            success: true,
            ref_id: data["ref_id"],
            status: data["status"] || "initiated",
            amount: data["amount"],
            currency: data["currency"],
            payment_reference: data["payment_reference"],
            refund_reference: payload[:reference],
            used_identifier: id,
            raw: body
          }
        else
          error_msg = body["message"] || "Failed to initiate refund (HTTP #{response.status})"
          {
            success: false,
            status_code: response.status,
            error: map_error_message(error_msg),
            error_code: body["message"],
            refund_reference: payload[:reference],
            used_identifier: id,
            raw: body
          }
        end
      rescue Faraday::Error => e
        log_safe_error("refund", e)
        {
          success: false,
          status_code: nil,
          error: I18n.t("chapa.errors.network_error", default: "Network error connecting to payment gateway: %{msg}", msg: e.message),
          refund_reference: payload[:reference],
          used_identifier: id
        }
      end

      def parse_json(raw)
        return {} if raw.blank?

        JSON.parse(raw)
      rescue JSON::ParserError
        { "message" => raw.to_s }
      end

      # Logs error messages ensuring no secrets or authorization headers appear in the output.
      def log_safe_error(action, error)
        sanitized_msg = error.message.gsub(/Bearer\s+[^\s]+/i, "Bearer [FILTERED]")
        Rails.logger.warn("[Chapa::Client #{action}] Error: #{sanitized_msg}")
      end
  end
end
