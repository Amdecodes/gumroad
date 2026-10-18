# frozen_string_literal: true

module Chapa
  class ExpireAbandonedTransactionsJob
    include Sidekiq::Job
    sidekiq_options queue: "low", retry: 2

    # Verifies and expires abandoned transactions older than 60 minutes
    def perform
      candidates = ChapaTransaction.abandoned_candidates(60.minutes.ago)
      candidates.find_each do |tx|
        next if tx.expired? || tx.cancelled? || tx.success?

        # One last verification attempt before expiring
        finalizer = FinalizerService.new(tx_ref: tx.tx_ref)
        result = finalizer.perform

        if result[:success]
          Rails.logger.info("[Chapa::ExpireAbandonedTransactionsJob] Succeeded on final check #{tx.tx_ref}")
        else
          tx.mark_expired!
          Rails.logger.info("[Chapa::ExpireAbandonedTransactionsJob] Expired abandoned #{tx.tx_ref}")
        end
      rescue StandardError => e
        Rails.logger.error("[Chapa::ExpireAbandonedTransactionsJob] Error processing #{tx.tx_ref}: #{e.message}")
        tx.mark_expired! rescue nil
      end
    end
  end
end
