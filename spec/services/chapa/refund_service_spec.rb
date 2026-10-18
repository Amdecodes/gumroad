# frozen_string_literal: true

require "spec_helper"

describe Chapa::RefundService do
  let(:seller) { create(:user) }
  let(:product) { create(:product, user: seller, price_cents: 100_00, price_currency_type: "etb") }
  let(:order) { create(:order) }
  let(:tx_ref) { "chk_test_#{SecureRandom.hex(6)}" }
  let(:purchase) do
    create(
      :purchase,
      order:,
      link: product,
      seller:,
      price_cents: 100_00,
      charge_processor_id: "chapa",
      stripe_transaction_id: tx_ref
    )
  end
  let!(:chapa_tx) do
    ChapaTransaction.create!(
      tx_ref:,
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

  subject { described_class.new(purchase:, client: mock_client) }

  describe "#perform" do
    context "when refund completes immediately on gateway" do
      before do
        allow(mock_client).to receive(:refund_transaction).with(
          tx_ref:,
          amount_santims: 100_00,
          reason: ""
        ).and_return(
          success: true,
          ref_id: "chp_ref_123",
          status: "refunded",
          raw: { "status" => "success" }
        )
      end

      it "marks purchase refunded and updates transaction logs" do
        result = subject.perform
        expect(result[:success]).to be true
        expect(result[:status]).to eq("refunded")
        expect(purchase.reload.stripe_refunded).to be true
      end
    end

    context "when refund is initiated or processing asynchronously" do
      before do
        allow(mock_client).to receive(:refund_transaction).with(
          tx_ref:,
          amount_santims: 100_00,
          reason: ""
        ).and_return(
          success: true,
          ref_id: "chp_ref_processing_456",
          status: "initiated",
          raw: { "status" => "pending" }
        )
        allow(Chapa::PollRefundStatusJob).to receive(:perform_in)
      end

      it "schedules polling job without prematurely marking purchase refunded" do
        result = subject.perform
        expect(result[:success]).to be true
        expect(result[:status]).to eq("initiated")
        expect(purchase.reload.refunded?).to be false
        expect(Chapa::PollRefundStatusJob).to have_received(:perform_in).with(
          30.seconds,
          "chp_ref_processing_456",
          purchase.id,
          100_00,
          "",
          nil
        )
      end
    end

    context "when gateway reports insufficient merchant balance" do
      before do
        allow(mock_client).to receive(:refund_transaction).with(
          tx_ref:,
          amount_santims: 100_00,
          reason: ""
        ).and_return(
          success: false,
          error: "Insufficient balance to perform refund"
        )
      end

      it "returns insufficient_balance status with clear guidance" do
        result = subject.perform
        expect(result[:success]).to be false
        expect(result[:status]).to eq("insufficient_balance")
        expect(result[:error]).to include("Insufficient Chapa merchant balance")
        expect(purchase.reload.refunded?).to be false
      end
    end

    context "when partial refund is requested" do
      subject { described_class.new(purchase:, amount_cents: 40_00, reason: "Defective item", client: mock_client) }

      before do
        allow(mock_client).to receive(:refund_transaction).with(
          tx_ref:,
          amount_santims: 40_00,
          reason: "Defective item"
        ).and_return(
          success: true,
          ref_id: "chp_partial_789",
          status: "refunded",
          raw: { "status" => "success" }
        )
      end

      it "submits the partial amount in santims and marks partial refund" do
        result = subject.perform
        expect(result[:success]).to be true
        expect(result[:status]).to eq("refunded")
        expect(purchase.reload.amount_refundable_cents).to eq(60_00)
      end
    end
  end

  describe "#check_and_finalize_refund" do
    before do
      allow(mock_client).to receive(:verify_refund).with("ref_poll_123").and_return(
        success: true,
        status: "refunded",
        raw: { "status" => "success" }
      )
    end

    it "transitions purchase to refunded once polling confirms completion" do
      result = subject.check_and_finalize_refund("ref_poll_123", 100_00)
      expect(result[:success]).to be true
      expect(result[:status]).to eq("refunded")
      expect(purchase.reload.stripe_refunded).to be true
    end
  end
end
