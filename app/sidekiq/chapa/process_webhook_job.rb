# frozen_string_literal: true

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

      if tx_ref.blank?
        event.mark_failed!("No tx_ref present in payload")
        return
      end

      result = FinalizerService.new(tx_ref:).perform

      if result[:success]
        event.mark_processed!
      else
        # If pending, keep as received/failed so retry job or reconciliation can handle it
        event.mark_failed!(result[:error] || "Finalization returned unsuccessful status: #{result[:status]}")
      end
    rescue StandardError => e
      Rails.logger.error("[Chapa::ProcessWebhookJob] Error processing webhook #{webhook_event_id}: #{e.message}")
      event&.mark_failed!(e.message)
      raise e
    end
  end
end
