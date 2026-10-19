# frozen_string_literal: true

require "ostruct"

class ChapaChargeProcessor
  extend CurrencyHelper

  DISPLAY_NAME = "Chapa"
  VALID_TRANSACTION_STATUSES = %w[success pending].freeze

  def self.charge_processor_id
    "chapa"
  end

  def refund!(charge_id, amount_cents: nil, purchase: nil, reason: nil, **_args)
    raise ChargeProcessorInvalidRequestError, "Purchase is required for Chapa refunds" unless purchase

    refund_amount_cents = amount_cents.presence || purchase.amount_refundable_cents
    if refund_amount_cents <= 0
      raise ChargeProcessorInvalidRequestError, "Refund amount must be greater than zero"
    end
    if refund_amount_cents > purchase.amount_refundable_cents
      raise ChargeProcessorInvalidRequestError, "Refund amount cannot exceed remaining refundable amount"
    end

    client = Chapa::Client.new
    tx_ref = purchase.processor_transaction_id.presence || charge_id
    chapa_tx = purchase.order&.chapa_transactions&.successful&.last || ChapaTransaction.find_by(tx_ref:)

    chapa_ref = chapa_tx&.chapa_reference.presence || purchase.stripe_transaction_id.presence
    primary_id = chapa_ref.presence || chapa_tx&.tx_ref || tx_ref
    fallback_id = (primary_id == chapa_ref && chapa_tx&.tx_ref.present? && chapa_tx.tx_ref != chapa_ref) ? chapa_tx.tx_ref : nil

    stable_ref = "rf_chp_#{chapa_tx&.tx_ref || purchase.id}_#{purchase.refunds.count + 1}"

    refund_record = purchase.chapa_refunds.find_or_initialize_by(refund_reference: stable_ref)
    refund_record.chapa_transaction ||= chapa_tx
    refund_record.amount_santims ||= refund_amount_cents

    if refund_record.persisted? && refund_record.status == "refunded"
      return ChapaChargeRefund.new({ ref_id: refund_record.chapa_ref_id, status: "refunded" }, charge_id, refund_amount_cents)
    end

    if refund_record.persisted? && refund_record.attempts_count > 0
      verification = refund_record.chapa_ref_id.present? ? client.verify_refund(refund_record.chapa_ref_id) : client.verify_transaction(tx_ref)
      verify_status = verification&.dig(:status).to_s.downcase
      if verification && verify_status == "refunded"
        refund_record.update!(status: "refunded", raw_payload: verification[:raw])
        return ChapaChargeRefund.new(verification, charge_id, refund_amount_cents)
      end
    end

    refund_record.attempts_count += 1
    refund_record.status = "initiated" if refund_record.status.blank? || refund_record.status == "failed"
    begin
      refund_record.save!
    rescue ActiveRecord::RecordNotUnique
      refund_record = purchase.chapa_refunds.find_by!(refund_reference: stable_ref)
      if refund_record.status == "refunded"
        return ChapaChargeRefund.new({ ref_id: refund_record.chapa_ref_id, status: "refunded" }, charge_id, refund_amount_cents)
      end
      refund_record.increment!(:attempts_count)
    end

    result = client.refund_transaction(
      identifier: primary_id,
      fallback_identifier: fallback_id,
      amount_santims: refund_amount_cents,
      reason:,
      reference: stable_ref
    )

    unless result[:success]
      error_msg = result[:error].to_s
      refund_record.update(status: "failed", error_message: error_msg, raw_payload: result[:raw])
      if error_msg.match?(/insufficient/i)
        raise ChargeProcessorInsufficientFundsError, "Insufficient Chapa merchant balance: #{error_msg}"
      elsif error_msg.match?(/already refunded/i)
        refund_record.update!(status: "refunded")
        return ChapaChargeRefund.new(result, charge_id, refund_amount_cents)
      else
        raise ChargeProcessorInvalidRequestError, "Chapa refund failed: #{error_msg}"
      end
    end

    refund_record.update!(
      status: result[:status].to_s.downcase.presence || "refunded",
      chapa_ref_id: result[:ref_id],
      raw_payload: result[:raw]
    )

    ChapaChargeRefund.new(result, charge_id, refund_amount_cents)
  end

  def get_charge(charge_id, merchant_account: nil)
    tx = ChapaTransaction.find_by(tx_ref: charge_id) || ChapaTransaction.find_by(chapa_reference: charge_id)
    return nil unless tx

    OpenStruct.new(
      id: tx.tx_ref,
      amount: tx.amount_santims,
      status: tx.status,
      currency: tx.currency
    )
  end

  def search_charge(purchase:)
    return nil unless purchase.processor_transaction_id.present?

    get_charge(purchase.processor_transaction_id)
  end

  def holder_of_funds(_merchant_account)
    HolderOfFunds::GUMROAD
  end

  def transaction_url(_charge_id)
    nil
  end
end
