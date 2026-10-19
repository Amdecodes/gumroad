# frozen_string_literal: true

require "spec_helper"

describe ChapaChargeProcessor do
  let(:seller) { create(:user) }
  let(:product) { create(:product, user: seller, price_cents: 100_00, price_currency_type: "etb") }
  let(:order) { create(:order) }
  let(:tx_ref) { "chk_processor_#{SecureRandom.hex(6)}" }
  let(:chapa_reference) { "CHP_REF_#{SecureRandom.hex(4)}" }
  let(:purchase) do
    create(
      :purchase,
      order:,
      link: product,
      seller:,
      price_cents: 100_00,
      charge_processor_id: "chapa",
      processor_transaction_id: tx_ref,
      stripe_transaction_id: chapa_reference
    )
  end
  let!(:chapa_tx) do
    ChapaTransaction.create!(
      tx_ref:,
      chapa_reference:,
      order:,
      purchase:,
      amount_santims: 100_00,
      amount_decimal: BigDecimal("100.00"),
      currency: "ETB",
      status: "success",
      mode: "test"
    )
  end
  let(:mock_client) { instance_double(Chapa::Client) }

  subject { described_class.new }

  before do
    allow(Chapa::Client).to receive(:new).and_return(mock_client)
  end

  describe "#refund!" do
    it "raises error when purchase is missing" do
      expect do
        subject.refund!(tx_ref, purchase: nil)
      end.to raise_error(ChargeProcessorInvalidRequestError, /Purchase is required/)
    end

    it "validates that refund amount is greater than zero" do
      expect do
        subject.refund!(tx_ref, amount_cents: 0, purchase:)
      end.to raise_error(ChargeProcessorInvalidRequestError, /greater than zero/)

      expect do
        subject.refund!(tx_ref, amount_cents: -500, purchase:)
      end.to raise_error(ChargeProcessorInvalidRequestError, /greater than zero/)
    end

    it "validates that refund amount does not exceed remaining refundable amount" do
      expect do
        subject.refund!(tx_ref, amount_cents: 150_00, purchase:)
      end.to raise_error(ChargeProcessorInvalidRequestError, /cannot exceed remaining refundable amount/)
    end

    it "initiates refund, creates ChapaRefund, and returns ChapaChargeRefund" do
      allow(mock_client).to receive(:refund_transaction).with(
        hash_including(
          identifier: chapa_reference,
          fallback_identifier: tx_ref,
          amount_santims: 100_00
        )
      ).and_return(
        success: true,
        ref_id: "chp_ref_processor_1",
        status: "refunded",
        used_identifier: chapa_reference,
        raw: { "status" => "success" }
      )

      refund = subject.refund!(tx_ref, purchase:)

      expect(refund).to be_a(ChapaChargeRefund)
      expect(refund.id).to eq("chp_ref_processor_1")
      expect(refund.status).to eq("refunded")

      chapa_refund = ChapaRefund.find_by!(refund_reference: "rf_chp_#{tx_ref}_1")
      expect(chapa_refund.status).to eq("refunded")
      expect(chapa_refund.attempts_count).to eq(1)
    end

    it "re-verifies status on retry after timeout and treats refunded status as success" do
      stable_ref = "rf_chp_#{tx_ref}_1"
      ChapaRefund.create!(
        purchase:,
        amount_santims: 100_00,
        refund_reference: stable_ref,
        status: "initiated",
        attempts_count: 1
      )

      allow(mock_client).to receive(:verify_transaction).with(tx_ref).and_return(
        success: false,
        status: "refunded",
        raw: { "status" => "success", "data" => { "status" => "refunded" } }
      )
      expect(mock_client).not_to receive(:refund_transaction)

      refund = subject.refund!(tx_ref, purchase:)
      expect(refund).to be_a(ChapaChargeRefund)
      expect(refund.status).to eq("refunded")
    end

    it "handles ActiveRecord::RecordNotUnique gracefully when concurrent record exists" do
      allow(mock_client).to receive(:refund_transaction).and_return(
        success: true,
        ref_id: "chp_ref_unique_proc",
        status: "refunded",
        used_identifier: chapa_reference,
        raw: { "status" => "success" }
      )

      call_count = 0
      allow_any_instance_of(ChapaRefund).to receive(:save!).and_wrap_original do |method, *args|
        call_count += 1
        if call_count == 1
          ChapaRefund.create!(
            purchase:,
            amount_santims: 100_00,
            refund_reference: "rf_chp_#{tx_ref}_1",
            status: "initiated"
          )
          raise ActiveRecord::RecordNotUnique, "Duplicate entry"
        else
          method.call(*args)
        end
      end

      refund = subject.refund!(tx_ref, purchase:)
      expect(refund).to be_a(ChapaChargeRefund)
      expect(refund.status).to eq("refunded")
    end
  end
end
