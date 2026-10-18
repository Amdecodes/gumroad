# frozen_string_literal: true

module Chapa
  class FinalizerService
    class VerificationError < StandardError; end
    class MismatchError < StandardError; end

    attr_reader :tx_ref, :client, :order, :transaction_record

    def initialize(tx_ref:, client: nil)
      @tx_ref = tx_ref.to_s.strip
      @client = client || Chapa::Client.new
      @transaction_record = ChapaTransaction.find_by(tx_ref: @tx_ref)
      @order = @transaction_record&.order || Order.find_by_external_id(@tx_ref) || find_order_by_purchase_tx_ref
    end

    # Executes verification and idempotent order finalization under a database row lock.
    # Safe to call concurrently from webhooks, callbacks, return handlers, and cron jobs.
    def perform
      return { success: false, error: "Order not found for tx_ref: #{tx_ref}" } unless order

      # Fast exit if already successfully processed
      if order_already_successful?
        return { success: true, status: "success", already_finalized: true, order: }
      end

      order.with_lock do
        # Double check after obtaining row lock
        if order_already_successful?
          return { success: true, status: "success", already_finalized: true, order: }
        end

        # Always verify state directly with Chapa gateway
        verification = client.verify_transaction(tx_ref)

        unless verification[:success]
          status = verification[:status] || "failed"
          if transaction_record
            if status == "pending"
              transaction_record.update!(status: "pending", raw_payload: (transaction_record.raw_payload || {}).merge("last_verify" => verification[:raw]))
            else
              transaction_record.mark_failed!(verification[:error], verification[:raw])
            end
          end
          return { success: false, status:, error: verification[:error], raw: verification }
        end

        # Strict integrity validation: amount, currency, mode, tx_ref
        validate_verification_integrity!(verification)

        # Mark ChapaTransaction as success
        transaction_record&.mark_successful!(verification)

        # Finalize purchases and order
        finalize_order_purchases!(verification)

        { success: true, status: "success", order: }
      end
    rescue MismatchError, VerificationError => e
      Rails.logger.error("[Chapa::FinalizerService] Validation error for #{tx_ref}: #{e.message}")
      transaction_record&.mark_failed!(e.message)
      { success: false, status: "failed", error: e.message }
    rescue StandardError => e
      Rails.logger.error("[Chapa::FinalizerService] Unexpected error finalizing #{tx_ref}: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
      { success: false, status: "error", error: e.message }
    end

    def reverify!
      perform
    end

    private
      def order_already_successful?
        order.purchases.present? && order.purchases.all?(&:successful?)
      end

      def find_order_by_purchase_tx_ref
        charge = Charge.find_by(processor: "chapa", processor_transaction_id: tx_ref)
        return charge.order if charge&.order

        purchase = Purchase.find_by(stripe_transaction_id: tx_ref)
        purchase&.order
      end

      def validate_verification_integrity!(verification)
        # 1. Currency must be ETB
        verified_currency = verification[:currency].to_s.upcase
        if verified_currency != "ETB"
          raise MismatchError, "Currency mismatch: expected ETB, got #{verified_currency}"
        end

        # 2. Amount verification using BigDecimal minor units (santims)
        verified_amount_santims = Money.birr_to_santims(verification[:amount])
        expected_amount_santims = order.purchases.sum do |p|
          p.respond_to?(:price_in_currency_cents) ? p.price_in_currency_cents : p.price_cents
        end

        if verified_amount_santims != expected_amount_santims
          raise MismatchError, "Amount mismatch: expected #{expected_amount_santims} santims, got #{verified_amount_santims} santims"
        end

        # 3. Mode check (test keys / test mode strictly forbidden in production)
        mode = verification[:mode].to_s.downcase
        if Rails.env.production? && mode == "test"
          raise MismatchError, "Security rejection: Test mode transaction received in production environment"
        end

        # 4. Reference match
        returned_ref = verification[:tx_ref] || verification[:reference]
        if returned_ref.blank?
          raise MismatchError, "Missing transaction reference in verification response"
        end

        if verification[:tx_ref].present? && verification[:tx_ref] != tx_ref
          raise MismatchError, "Transaction reference mismatch: expected #{tx_ref}, got #{verification[:tx_ref]}"
        end
      end

      def finalize_order_purchases!(verification)
        reference = verification[:reference].presence || tx_ref

        # Reconcile or create processor Charge
        charge = order.charges.where(processor: "chapa").first_or_initialize(processor_transaction_id: tx_ref)
        charge.seller_id = order.purchases.first.seller_id
        charge.processor = "chapa"
        charge.processor_transaction_id = reference
        charge.amount_cents = order.purchases.sum(&:price_cents)
        if verification[:charge].present?
          charge.processor_fee_cents = Money.birr_to_santims(verification[:charge])
          charge.processor_fee_currency = "etb"
        end
        charge.save!

        # Finalize in-progress purchases
        purchases_to_finalize = order.purchases.select(&:in_progress?)
        purchases_to_finalize.each do |p|
          p.lock!
          p.stripe_transaction_id = reference
          p.charge_processor_id = "chapa"
          p.calculate_fees if p.fee_cents.nil?
          p.fee_cents ||= 0
          p.charge = charge

          target_locale = p.locale.presence || I18n.default_locale
          I18n.with_locale(target_locale) do
            Purchase::MarkSuccessfulService.new(p).perform
          end
        end

        # Send customer charge receipts
        order.send_charge_receipts if order.respond_to?(:send_charge_receipts)
      end
  end
end
