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

    client = Chapa::Client.new
    tx_ref = purchase.processor_transaction_id.presence || charge_id
    chapa_tx = purchase.order&.chapa_transactions&.successful&.last || ChapaTransaction.find_by(tx_ref:)

    chapa_ref = chapa_tx&.chapa_reference.presence || purchase.stripe_transaction_id.presence
    primary_id = chapa_ref.presence || chapa_tx&.tx_ref || tx_ref
    fallback_id = (primary_id == chapa_ref && chapa_tx&.tx_ref.present? && chapa_tx.tx_ref != chapa_ref) ? chapa_tx.tx_ref : nil

    refund_amount_cents = amount_cents.presence || purchase.amount_refundable_cents
    unique_ref = "rf_#{chapa_tx&.tx_ref || purchase.id}_#{refund_amount_cents}_#{SecureRandom.hex(4)}"

    result = client.refund_transaction(
      identifier: primary_id,
      fallback_identifier: fallback_id,
      amount_santims: refund_amount_cents,
      reason:,
      reference: unique_ref
    )

    unless result[:success]
      error_msg = result[:error].to_s
      if error_msg.match?(/insufficient/i)
        raise ChargeProcessorInsufficientFundsError, "Insufficient Chapa merchant balance: #{error_msg}"
      elsif error_msg.match?(/already refunded/i)
        raise ChargeProcessorAlreadyRefundedError, "Charge already refunded: #{error_msg}"
      else
        raise ChargeProcessorInvalidRequestError, "Chapa refund failed: #{error_msg}"
      end
    end

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
