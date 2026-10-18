# frozen_string_literal: true

require "ostruct"

module Chapa
  class RefundService
    attr_reader :purchase, :amount_cents, :reason, :admin_user, :client

    def initialize(purchase:, amount_cents: nil, reason: nil, admin_user: nil, client: nil)
      @purchase = purchase
      @amount_cents = amount_cents.present? ? amount_cents.to_i : nil
      @reason = reason.to_s.strip
      @admin_user = admin_user
      @client = client || Chapa::Client.new
    end

    def perform
      return { success: false, error: "Purchase is required" } unless purchase
      return { success: false, error: "Purchase is already fully refunded" } if purchase.stripe_refunded
      return { success: false, error: "No refundable amount remaining" } if purchase.amount_refundable_cents <= 0

      refund_santims = amount_cents.presence || purchase.amount_refundable_cents
      if refund_santims > purchase.amount_refundable_cents
        return { success: false, error: "Refund amount cannot exceed remaining refundable amount" }
      end

      # Find associated transaction
      tx = purchase.order&.chapa_transactions&.successful&.last ||
           ChapaTransaction.where(purchase:).or(ChapaTransaction.where(order: purchase.order)).successful.last ||
           ChapaTransaction.find_by(tx_ref: purchase.processor_transaction_id) ||
           ChapaTransaction.find_by(chapa_reference: purchase.processor_transaction_id)
      identifier = tx&.tx_ref.presence || purchase.processor_transaction_id

      result = client.refund_transaction(tx_ref: identifier, amount_santims: refund_santims, reason:)

      unless result[:success]
        error_msg = result[:error].to_s
        if error_msg.match?(/insufficient/i)
          return { success: false, status: "insufficient_balance", error: "Insufficient Chapa merchant balance to process refund. Please top up your balance." }
        end

        return { success: false, status: "failed", error: error_msg }
      end

      ref_id = result[:ref_id] || "ref_#{SecureRandom.hex(6)}"
      status = result[:status].to_s.downcase.presence || "initiated"

      # Record in ChapaTransaction
      record_refund_attempt(tx, ref_id:, amount_santims: refund_santims, status:, raw: result[:raw])

      case status
      when "refunded"
        mark_purchase_refunded!(refund_santims, ref_id)
        { success: true, status: "refunded", message: "Successfully refunded purchase." }
      when "initiated", "processing", "pending"
        PollRefundStatusJob.perform_in(30.seconds, ref_id, purchase.id, refund_santims, reason, admin_user&.id)
        { success: true, status:, message: "Refund initiated and is currently processing with Chapa." }
      when "reversed"
        { success: false, status: "reversed", error: "Refund was reversed by Chapa." }
      else
        PollRefundStatusJob.perform_in(30.seconds, ref_id, purchase.id, refund_santims, reason, admin_user&.id)
        { success: true, status:, message: "Refund #{status} with Chapa." }
      end
    rescue StandardError => e
      Rails.logger.error("[Chapa::RefundService] Error processing refund: #{e.message}")
      { success: false, error: e.message }
    end

    def check_and_finalize_refund(ref_id, refund_santims)
      verification = client.verify_refund(ref_id)
      status = verification[:status].to_s.downcase

      tx = purchase.order&.chapa_transactions&.successful&.last ||
           ChapaTransaction.find_by(tx_ref: purchase.processor_transaction_id)
      update_refund_status(tx, ref_id:, status:)

      if status == "refunded"
        mark_purchase_refunded!(refund_santims, ref_id)
        { success: true, status: "refunded" }
      else
        { success: false, status: }
      end
    end

    private
      def mark_purchase_refunded!(refund_santims, ref_id)
        return if purchase.stripe_refunded

        flow_of_funds = FlowOfFunds.build_simple_flow_of_funds(Currency::ETB, -refund_santims)
        refund_obj = OpenStruct.new(id: ref_id, status: "refunded")
        purchase.refund_purchase!(
          flow_of_funds,
          admin_user&.id,
          refund_obj,
          false,
          note: reason
        )
      end

      def record_refund_attempt(tx, ref_id:, amount_santims:, status:, raw:)
        return unless tx

        refunds = tx.raw_payload&.dig("refunds") || []
        refunds << {
          "ref_id" => ref_id,
          "amount_santims" => amount_santims,
          "status" => status,
          "reason" => reason,
          "created_at" => Time.current.as_json,
          "raw" => raw
        }
        tx.update!(raw_payload: (tx.raw_payload || {}).merge("refunds" => refunds))
      end

      def update_refund_status(tx, ref_id:, status:)
        return unless tx

        refunds = tx.raw_payload&.dig("refunds") || []
        refunds.each do |r|
          r["status"] = status if r["ref_id"] == ref_id
        end
        tx.update!(raw_payload: (tx.raw_payload || {}).merge("refunds" => refunds))
      end
  end
end
