# frozen_string_literal: true

class ChapaChargeRefund < ChargeRefund
  include CurrencyHelper

  attr_reader :raw_response

  def initialize(chapa_refund_result, charge_id, amount_cents)
    self.charge_processor_id = ChapaChargeProcessor.charge_processor_id
    self.id = chapa_refund_result[:ref_id] || chapa_refund_result["ref_id"] || "chp_ref_#{SecureRandom.hex(6)}"
    self.charge_id = charge_id
    self.flow_of_funds = FlowOfFunds.build_simple_flow_of_funds(Currency::ETB, -amount_cents)
    @raw_response = chapa_refund_result
  end

  def status
    raw_response[:status] || raw_response["status"] || "refunded"
  end
end
