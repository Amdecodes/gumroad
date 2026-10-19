# frozen_string_literal: true

require "ostruct"

module Chapa
  class ProcessWebhookJob
    include Sidekiq::Job
    sidekiq_options queue: "default", retry: 3

    def perform(webhook_event_id)
      event = ChapaWebhookEvent.find_by(id: webhook_event_id)
      return unless event
      return if event.status == "processed"

      event.mark_processing!
      payload = event.parsed_payload
      tx_ref = event.tx_ref.presence || payload["tx_ref"].presence || payload.dig("data", "tx_ref").presence
      chapa_reference = payload["reference"].presence || payload["chapa_reference"].presence || payload.dig("data", "reference").presence

      # Decide routing from payload status and event type, rather than depending on a single event name
      status = (payload["status"] || payload.dig("data", "status")).to_s.downcase
      event_type = (event.event_type || payload["event"] || payload["type"]).to_s.downcase
      is_transfer = event_type.start_with?("payout", "transfer") || payload["type"].to_s.downcase == "payout"

      client = Chapa::Client.new

      case
      when !is_transfer && (status == "success" || event_type == "charge.success")
        if tx_ref.blank?
          event.mark_failed!("No tx_ref present in payload for successful charge")
          return
        end

        # Always re-verify via the API
        result = FinalizerService.new(tx_ref:, client:).perform
        if result[:success]
          event.mark_processed!
        else
          event.mark_failed!(result[:error] || "Finalization returned #{result[:status]}")
        end

      when status.in?(%w[refunded refunding]) || event_type.include?("refund")
        # Always re-verify via the API
        lookup_ref = tx_ref.presence || chapa_reference
        if lookup_ref.blank?
          event.mark_failed!("Missing reference to verify refund event")
          return
        end

        tx = ChapaTransaction.find_by(tx_ref:) || ChapaTransaction.find_by(chapa_reference:)
        verification = client.verify_transaction(tx&.tx_ref || lookup_ref)

        if verification[:success]
          api_status = verification[:status].to_s.downcase
          tx&.update!(status: "refunded") if tx && api_status.in?(%w[refunded refunding])

          # If purchase is present and not yet refunded, mark it refunded
          purchase = tx&.purchase || (tx&.order&.purchases&.first)
          if purchase.present? && !purchase.stripe_refunded && api_status == "refunded"
            ref_id = chapa_reference.presence || verification[:reference] || "ref_webhook_#{event.id}"
            flow_of_funds = FlowOfFunds.build_simple_flow_of_funds(Currency::ETB, -purchase.amount_refundable_cents)
            refund_obj = OpenStruct.new(id: ref_id, status: "refunded")
            purchase.refund_purchase!(flow_of_funds, nil, refund_obj, false, note: "Webhook confirmed refund")
          end

          event.mark_processed!
        else
          event.mark_failed!("Re-verification failed for refund event: #{verification[:error]}")
        end

      when status == "reversed" || event_type.include?("reversed")
        lookup_ref = tx_ref.presence || chapa_reference
        if lookup_ref.present?
          verification = client.verify_transaction(lookup_ref)
          tx = ChapaTransaction.find_by(tx_ref:) || ChapaTransaction.find_by(chapa_reference:)
          if tx.present? && verification[:success] && verification[:status].to_s.downcase == "reversed"
            tx.update!(status: "reversed")

            purchase = tx.purchase || tx.order&.purchases&.first
            if purchase.present? && !purchase.stripe_refunded
              flow_of_funds = FlowOfFunds.build_simple_flow_of_funds(Currency::ETB, -purchase.amount_refundable_cents)
              refund_obj = OpenStruct.new(id: "rev_#{tx.tx_ref}", status: "reversed")
              purchase.refund_purchase!(flow_of_funds, nil, refund_obj, false, note: "Gateway reversal: Chapa charge reversed")
            end

            ErrorNotifier.notify(
              "Chapa transaction reversed",
              context: { tx_ref:, chapa_reference:, purchase_id: purchase&.id, order_id: tx.order_id }
            )
          end
        end

        Rails.logger.warn("[Chapa Webhook] Charge reversed for tx_ref: #{tx_ref}, reference: #{chapa_reference}")
        event.mark_processed!

      when status.in?(%w[failed cancelled]) || event_type.include?("failed") || event_type.include?("cancelled")
        # Always re-verify via the API
        if tx_ref.present?
          verification = client.verify_transaction(tx_ref)
          tx = ChapaTransaction.find_by(tx_ref:)
          if tx.present? && tx.status != "success"
            tx.update!(
              status: "failed",
              error_message: verification[:error] || "Gateway confirmed failed/cancelled",
              raw_payload: (tx.raw_payload || {}).merge("final_verify" => verification[:raw])
            )
          end
        end

        Rails.logger.info("[Chapa Webhook] Acknowledged failed/cancelled transaction for tx_ref: #{tx_ref}")
        event.mark_processed!

      else
        # Unknown event/status: acknowledge with 200 and log line
        Rails.logger.info("[Chapa Webhook] Acknowledged unknown event '#{event.event_type}' / status '#{status}' for tx_ref '#{tx_ref}'")
        event.mark_processed!
      end
    rescue StandardError => e
      Rails.logger.error("[Chapa::ProcessWebhookJob] Error processing webhook #{webhook_event_id}: #{e.message}")
      event&.mark_failed!(e.message)
      raise e
    end
  end
end
