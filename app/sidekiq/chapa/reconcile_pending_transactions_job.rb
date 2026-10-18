# frozen_string_literal: true

module Chapa
  class ReconcilePendingTransactionsJob
    include Sidekiq::Job
    sidekiq_options queue: "low", retry: 2

    # Reconciles pending transactions older than 5 minutes directly with Chapa
    def perform
      candidates = ChapaTransaction.reconciliation_candidates(5.minutes.ago)
      candidates.find_each do |tx|
        next if tx.expired? || tx.cancelled? || tx.success?

        finalizer = FinalizerService.new(tx_ref: tx.tx_ref)
        result = finalizer.perform
        Rails.logger.info("[Chapa::ReconcilePendingTransactionsJob] Reconciled #{tx.tx_ref}: #{result[:status]}")
      rescue StandardError => e
        Rails.logger.error("[Chapa::ReconcilePendingTransactionsJob] Failed to reconcile #{tx.tx_ref}: #{e.message}")
      end
    end
  end
end
