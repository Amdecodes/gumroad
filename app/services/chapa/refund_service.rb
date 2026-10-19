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

      if purchase.stripe_refunded
        if purchase.chapa_refunds.refunded.exists?
          return { success: true, status: "refunded", message: "Successfully refunded purchase." }
        end
        return { success: false, error: "Purchase is already fully refunded" }
      end

      return { success: false, error: "No refundable amount remaining" } if purchase.amount_refundable_cents <= 0

      refund_santims = amount_cents.presence || purchase.amount_refundable_cents
      if refund_santims > purchase.amount_refundable_cents
        return { success: false, error: "Refund amount cannot exceed remaining refundable amount" }
      end
      if refund_santims <= 0
        return { success: false, error: "Refund amount must be greater than zero" }
      end

      tx = purchase.order&.chapa_transactions&.successful&.last ||
           purchase.order&.chapa_transactions&.last ||
           ChapaTransaction.where(purchase:).successful.last ||
           ChapaTransaction.where(purchase:).last ||
           ChapaTransaction.find_by(tx_ref: purchase.processor_transaction_id) ||
           ChapaTransaction.find_by(chapa_reference: purchase.processor_transaction_id)

      chapa_ref = tx&.chapa_reference.presence || purchase.stripe_transaction_id.presence
      tx_ref = tx&.tx_ref.presence || purchase.processor_transaction_id.presence

      primary_identifier = chapa_ref.presence || tx_ref
      fallback_identifier = (primary_identifier == chapa_ref && tx_ref.present? && tx_ref != chapa_ref) ? tx_ref : nil
      stable_refund_ref = "rf_chp_#{tx&.tx_ref || purchase.id}_#{purchase.refunds.count + 1}"

      refund_record = nil
      purchase.with_lock do
        purchase.reload

        if purchase.stripe_refunded
          if purchase.chapa_refunds.refunded.exists?
            return { success: true, status: "refunded", message: "Successfully refunded purchase." }
          end
          return { success: false, error: "Purchase is already fully refunded" }
        end

        refund_record = purchase.chapa_refunds.find_or_initialize_by(refund_reference: stable_refund_ref)
        refund_record.chapa_transaction ||= tx
        refund_record.amount_santims ||= refund_santims

        if refund_record.persisted? && refund_record.status == "refunded"
          return { success: true, status: "refunded", message: "Successfully refunded purchase." }
        end

        if refund_record.persisted? && refund_record.attempts_count > 0
          verification =
            if refund_record.chapa_ref_id.present?
              client.verify_refund(refund_record.chapa_ref_id)
            elsif tx_ref.present?
              client.verify_transaction(tx_ref)
            end

          verify_status = verification&.dig(:status).to_s.downcase
          if verification && verification[:success] && verify_status == "refunded"
            refund_record.update!(
              status: "refunded",
              raw_payload: (refund_record.raw_payload || {}).merge("verification" => verification[:raw])
            )
            mark_purchase_refunded!(refund_santims, refund_record.chapa_ref_id || stable_refund_ref, stable_refund_ref)
            return { success: true, status: "refunded", message: "Successfully refunded purchase." }
          end
        end

        refund_record.attempts_count += 1
        refund_record.status = "initiated" if refund_record.status.blank? || refund_record.status == "failed"
        refund_record.save!

        result = client.refund_transaction(
          identifier: primary_identifier,
          fallback_identifier:,
          amount_santims: refund_santims,
          reason:,
          reference: stable_refund_ref
        )

        unless result[:success]
          error_msg = result[:error].to_s
          refund_record.update(
            status: "failed",
            error_message: error_msg,
            raw_payload: (refund_record.raw_payload || {}).merge("response" => result[:raw])
          )

          if error_msg.match?(/insufficient/i)
            return { success: false, status: "insufficient_balance", error: "Insufficient Chapa merchant balance to process refund. Please top up your balance." }
          elsif error_msg.match?(/already refunded/i)
            refund_record.update!(status: "refunded")
            mark_purchase_refunded!(refund_santims, refund_record.chapa_ref_id || stable_refund_ref, stable_refund_ref)
            return { success: true, status: "refunded", message: "Successfully refunded purchase." }
          end

          return { success: false, status: "failed", error: error_msg }
        end

        ref_id = result[:ref_id] || "ref_#{SecureRandom.hex(6)}"
        status = result[:status].to_s.downcase.presence || "initiated"
        used_id = result[:used_identifier] || primary_identifier

        refund_record.update!(
          status:,
          chapa_ref_id: ref_id,
          raw_payload: (refund_record.raw_payload || {}).merge("response" => result[:raw])
        )

        record_refund_attempt(
          tx,
          ref_id:,
          refund_reference: stable_refund_ref,
          used_identifier: used_id,
          amount_santims: refund_santims,
          status:,
          raw: result[:raw]
        )

        case status
        when "refunded"
          mark_purchase_refunded!(refund_santims, ref_id, stable_refund_ref)
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
      end
    rescue StandardError => e
      refund_record&.update(error_message: e.message) if refund_record&.persisted?
      Rails.logger.error("[Chapa::RefundService] Error processing refund: #{e.message}")
      { success: false, error: e.message }
    end

    def check_and_finalize_refund(ref_id, refund_santims)
      verification = client.verify_refund(ref_id)
      status = verification[:status].to_s.downcase

      tx = purchase.order&.chapa_transactions&.successful&.last ||
           ChapaTransaction.find_by(tx_ref: purchase.processor_transaction_id)
      update_refund_status(tx, ref_id:, status:)

      chapa_refund = ChapaRefund.find_by(chapa_ref_id: ref_id) ||
                     purchase.chapa_refunds.where(status: %w[initiated processing]).last
      chapa_refund&.update(status:)

      if status == "refunded"
        mark_purchase_refunded!(refund_santims, ref_id, chapa_refund&.refund_reference)
        { success: true, status: "refunded" }
      else
        { success: false, status: }
      end
    end

    private
      def mark_purchase_refunded!(refund_santims, ref_id, refund_reference = nil)
        return if purchase.stripe_refunded

        flow_of_funds = FlowOfFunds.build_simple_flow_of_funds(Currency::ETB, -refund_santims)
        refund_obj = OpenStruct.new(id: ref_id, refund_reference:, status: "refunded")
        purchase.refund_purchase!(
          flow_of_funds,
          admin_user&.id,
          refund_obj,
          false,
          note: reason
        )
      end

      def record_refund_attempt(tx, ref_id:, refund_reference: nil, used_identifier: nil, amount_santims:, status:, raw:)
        return unless tx

        refunds = tx.raw_payload&.dig("refunds") || []
        refunds << {
          "ref_id" => ref_id,
          "refund_reference" => refund_reference,
          "used_identifier" => used_identifier,
          "chapa_reference" => tx.chapa_reference,
          "tx_ref" => tx.tx_ref,
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
