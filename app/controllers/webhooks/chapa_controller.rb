# frozen_string_literal: true

module Webhooks
  class ChapaController < ApplicationController
    skip_before_action :verify_authenticity_token

    def create
      raw_body = request.raw_post
      signature = request.headers["Chapa-Signature"] ||
                  request.headers["HTTP_CHAPA_SIGNATURE"] ||
                  request.headers["x-chapa-signature"]

      client = Chapa::Client.new
      unless client.valid_signature?(raw_body, signature)
        Rails.logger.warn("[Chapa Webhook] Invalid signature received from IP #{request.remote_ip}")
        return render json: { error: "Invalid signature" }, status: :unauthorized
      end

      payload = parse_payload(raw_body)
      tx_ref = payload["tx_ref"] || payload.dig("data", "tx_ref")

      if tx_ref.blank?
        return render json: { error: "Missing tx_ref" }, status: :bad_request
      end

      purchase = Purchase.find_by_processor_transaction_id(tx_ref)
      unless purchase
        return render json: { error: "Purchase not found" }, status: :not_found
      end

      if purchase.successful?
        return render json: { status: "success", message: "Purchase already finalized" }, status: :ok
      end

      verification = client.verify_transaction(tx_ref)
      unless verification[:success]
        Rails.logger.warn("[Chapa Webhook] Gateway verification returned unsuccessful status for #{tx_ref}: #{verification[:status] || verification[:error]}")
        return render json: { error: "Gateway verification failed" }, status: :unprocessable_entity
      end

      verified_currency = verification[:currency].to_s.upcase
      verified_amount_santims = (verification[:amount].to_f * 100).round

      if verified_currency != "ETB" || verified_currency != purchase.displayed_price_currency_type.to_s.upcase
        Rails.logger.error("[Chapa Webhook] Currency mismatch for #{tx_ref}: expected #{purchase.displayed_price_currency_type.to_s.upcase}, got #{verified_currency}")
        return render json: { error: "Currency mismatch" }, status: :unprocessable_entity
      end

      expected_santims = purchase.respond_to?(:price_in_currency_cents) ? purchase.price_in_currency_cents : purchase.price_cents
      if verified_amount_santims != expected_santims
        Rails.logger.error("[Chapa Webhook] Amount mismatch for #{tx_ref}: expected #{expected_santims} santims, got #{verified_amount_santims} santims")
        return render json: { error: "Amount mismatch" }, status: :unprocessable_entity
      end

      ActiveRecord::Base.transaction do
        purchase.lock!
        if purchase.successful?
          return render json: { status: "success", message: "Purchase already finalized" }, status: :ok
        end

        reference = verification[:reference].presence || tx_ref
        purchases_to_finalize = purchase.order.present? ? purchase.order.purchases.select(&:in_progress?) : [purchase]

        purchases_to_finalize.each do |p|
          p.stripe_transaction_id = reference
          p.charge_processor_id = "chapa"
          p.calculate_fees if p.fee_cents.nil?
          p.fee_cents ||= 0
          if (charge = p.charge)
            charge.processor = "chapa"
            charge.processor_transaction_id = reference
            charge.save!
          end

          if p.subscription.present?
            p.subscription.lock!
            p.subscription.advance_renewal_period!(p)
          else
            Purchase::MarkSuccessfulService.new(p).perform
          end
        end

        purchase.order.send_charge_receipts if purchase.order.present?
      end

      render json: { status: "success", message: "Purchase successfully finalized" }, status: :ok
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
