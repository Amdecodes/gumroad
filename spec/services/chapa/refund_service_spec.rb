# frozen_string_literal: true

require "spec_helper"

describe Chapa::RefundService do
  let(:seller) { create(:user) }
  let(:product) { create(:product, user: seller, price_cents: 100_00, price_currency_type: "etb") }
  let(:order) { create(:order) }
  let(:tx_ref) { "chk_test_#{SecureRandom.hex(6)}" }
  let(:chapa_reference) { "CHAPA_REF_#{SecureRandom.hex(4)}" }
  let(:purchase) do
    create(
      :purchase,
      order:,
      link: product,
      seller:,
      price_cents: 100_00,
      charge_processor_id: "chapa",
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

  subject { described_class.new(purchase:, client: mock_client) }

  describe "#perform" do
    context "when refund completes immediately on gateway" do
      before do
        allow(mock_client).to receive(:refund_transaction).with(
          hash_including(
            identifier: chapa_reference,
            fallback_identifier: tx_ref,
            amount_santims: 100_00,
            reason: ""
          )
        ).and_return(
          success: true,
          ref_id: "chp_ref_123",
          status: "refunded",
          used_identifier: chapa_reference,
          raw: { "status" => "success" }
        )
      end

      it "marks purchase refunded and records both IDs in transaction logs" do
        result = subject.perform
        expect(result[:success]).to be true
        expect(result[:status]).to eq("refunded")
        expect(purchase.reload.stripe_refunded).to be true

        chapa_tx.reload
        refunds = chapa_tx.raw_payload["refunds"]
        expect(refunds).to be_an(Array)
        recorded = refunds.last
        expect(recorded["ref_id"]).to eq("chp_ref_123")
        expect(recorded["refund_reference"]).to start_with("rf_")
        expect(recorded["chapa_reference"]).to eq(chapa_reference)
        expect(recorded["tx_ref"]).to eq(tx_ref)
      end
    end

    context "when refund is initiated or processing asynchronously" do
      before do
        allow(mock_client).to receive(:refund_transaction).with(
          hash_including(
            identifier: chapa_reference,
            fallback_identifier: tx_ref,
            amount_santims: 100_00,
            reason: ""
          )
        ).and_return(
          success: true,
          ref_id: "chp_ref_processing_456",
          status: "initiated",
          used_identifier: chapa_reference,
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
          hash_including(
            identifier: chapa_reference,
            fallback_identifier: tx_ref,
            amount_santims: 100_00,
            reason: ""
          )
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
          hash_including(
            identifier: chapa_reference,
            fallback_identifier: tx_ref,
            amount_santims: 40_00,
            reason: "Defective item"
          )
        ).and_return(
          success: true,
          ref_id: "chp_partial_789",
          status: "refunded",
          used_identifier: chapa_reference,
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

    context "when partial refund exceeds refundable amount" do
      subject { described_class.new(purchase:, amount_cents: 150_00, client: mock_client) }

      it "rejects partial refunds exceeding the refundable amount locally" do
        expect(mock_client).not_to receive(:refund_transaction)

        result = subject.perform
        expect(result[:success]).to be false
        expect(result[:error]).to include("cannot exceed")
        expect(ChapaRefund.count).to eq(0) if defined?(ChapaRefund)
      end
    end

    context "when retrying after a timeout" do
      let(:stable_ref) { "rf_chp_#{tx_ref}_1" }

      it "reuses stable refund reference and does not double-refund after a timeout retry" do
        allow(mock_client).to receive(:refund_transaction).with(
          hash_including(reference: stable_ref)
        ).and_return(
          success: false,
          error: "Network error connecting to payment gateway: execution expired"
        )

        first_result = subject.perform
        expect(first_result[:success]).to be false
        expect(purchase.reload.refunded?).to be false

        chapa_refund = ChapaRefund.find_by!(refund_reference: stable_ref)
        expect(chapa_refund.attempts_count).to eq(1)

        allow(mock_client).to receive(:verify_transaction).with(tx_ref).and_return(
          success: true,
          status: "refunded",
          amount: 100.00,
          currency: "ETB",
          reference: chapa_reference,
          tx_ref:,
          mode: "test",
          charge: nil,
          payment_method: nil,
          raw: { "status" => "success", "data" => { "status" => "refunded" } }
        )

        expect(mock_client).not_to receive(:refund_transaction)

        second_result = subject.perform
        expect(second_result[:success]).to be true
        expect(second_result[:status]).to eq("refunded")
        expect(purchase.reload.stripe_refunded).to be true
        expect(chapa_refund.reload.status).to eq("refunded")
      end

      it "finalizes refund even if verification[:success] is false when status is refunded" do
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

        result = subject.perform
        expect(result[:success]).to be true
        expect(result[:status]).to eq("refunded")
        expect(purchase.reload.stripe_refunded).to be true
      end
    end

    context "when two simultaneous requests occur" do
      it "creates only one refund record and dispatches one refund POST when two simultaneous requests occur" do
        allow(mock_client).to receive(:refund_transaction).and_return(
          success: true,
          ref_id: "chp_ref_concurrent",
          status: "refunded",
          used_identifier: chapa_reference,
          raw: { "status" => "success" }
        )
        allow(mock_client).to receive(:verify_transaction).with(tx_ref).and_return(
          success: true,
          status: "refunded",
          raw: { "status" => "success", "data" => { "status" => "refunded" } }
        )

        service1 = described_class.new(purchase:, client: mock_client)
        service2 = described_class.new(purchase:, client: mock_client)

        barrier = Queue.new
        threads = [service1, service2].map do |service|
          Thread.new do
            barrier.pop
            service.perform
          end
        end

        2.times { barrier << true }
        results = threads.map(&:value)

        expect(results.all? { |r| r[:success] }).to be true
        expect(results.map { |r| r[:status] }).to eq(%w[refunded refunded])
        expect(ChapaRefund.where(purchase:).count).to eq(1)
        expect(mock_client).to have_received(:refund_transaction).once
        expect(purchase.reload.stripe_refunded).to be true
        expect(purchase.refunds.count).to eq(1)
      end

      it "handles ActiveRecord::RecordNotUnique gracefully on duplicate refund_reference" do
        allow(mock_client).to receive(:refund_transaction).and_return(
          success: true,
          ref_id: "chp_ref_unique_test",
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
              refund_reference: "rf_chp_#{chapa_tx.tx_ref}_1",
              status: "initiated"
            )
            raise ActiveRecord::RecordNotUnique, "Duplicate entry"
          else
            method.call(*args)
          end
        end

        result = subject.perform
        expect(result[:success]).to be true
        expect(result[:status]).to eq("refunded")
        expect(ChapaRefund.where(purchase:).count).to eq(1)
        expect(purchase.reload.stripe_refunded).to be true
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

    it "does not update ChapaRefund status to error when verification encounters an error" do
      chapa_refund = ChapaRefund.create!(
        purchase:,
        amount_santims: 100_00,
        refund_reference: "rf_chp_#{tx_ref}_1",
        chapa_ref_id: "ref_poll_error",
        status: "initiated"
      )

      allow(mock_client).to receive(:verify_refund).with("ref_poll_error").and_return(
        success: false,
        status: "error",
        error: "Network error connecting to payment gateway",
        raw: {}
      )

      result = subject.check_and_finalize_refund("ref_poll_error", 100_00)
      expect(result[:success]).to be false
      expect(result[:status]).to eq("error")
      expect(chapa_refund.reload.status).to eq("initiated")
      expect(chapa_refund.error_message).to eq("Network error connecting to payment gateway")
    end
  end
end
