# frozen_string_literal: true

require "spec_helper"

describe Chapa::FinalizerService do
  let(:seller) { create(:user) }
  let(:product) { create(:product, user: seller, price_cents: 100_00, price_currency_type: "etb") }
  let(:order) { create(:order) }
  let(:purchase) do
    create(
      :purchase_in_progress,
      order:,
      link: product,
      seller:,
      price_cents: 100_00,
      charge_processor_id: "chapa",
      stripe_transaction_id: tx_ref
    )
  end
  let(:tx_ref) { "chk_test_#{SecureRandom.hex(6)}" }
  let!(:chapa_tx) do
    ChapaTransaction.create!(
      tx_ref:,
      order:,
      purchase:,
      amount_santims: 100_00,
      amount_decimal: BigDecimal("100.00"),
      currency: "ETB",
      status: "pending",
      mode: "test"
    )
  end

  let(:mock_client) { instance_double(Chapa::Client) }

  subject { described_class.new(tx_ref:, client: mock_client) }

  describe "#perform" do
    context "when gateway returns valid successful payment" do
      before do
        allow(mock_client).to receive(:verify_transaction).with(tx_ref).and_return(
          success: true,
          status: "success",
          tx_ref:,
          reference: "chp_ref_12345",
          amount: BigDecimal("100.00"),
          currency: "ETB",
          charge: BigDecimal("3.50"),
          mode: "test",
          payment_method: "telebirr",
          raw: { "status" => "success" }
        )
      end

      it "marks transaction record as success and finalizes purchases idempotently" do
        result = subject.perform

        expect(result[:success]).to be true
        expect(result[:status]).to eq("success")

        chapa_tx.reload
        expect(chapa_tx.status).to eq("success")
        expect(chapa_tx.chapa_reference).to eq("chp_ref_12345")
        expect(chapa_tx.charge_decimal).to eq(BigDecimal("3.50"))
        expect(chapa_tx.payment_method).to eq("telebirr")

        purchase.reload
        expect(purchase.successful?).to be true
        expect(purchase.charge_processor_id).to eq("chapa")
        expect(purchase.stripe_transaction_id).to eq("chp_ref_12345")
      end

      it "is idempotent and safe to run multiple times" do
        first_result = subject.perform
        expect(first_result[:success]).to be true

        second_result = subject.perform
        expect(second_result[:success]).to be true
        expect(second_result[:already_finalized]).to be true
      end

      it "allows a previously failed transaction to succeed on subsequent verified check" do
        chapa_tx.mark_failed!("Temporary network issue")
        expect(chapa_tx.status).to eq("failed")

        result = subject.perform
        expect(result[:success]).to be true
        expect(chapa_tx.reload.status).to eq("success")
      end
    end

    context "when integrity check fails" do
      it "rejects currency mismatch" do
        allow(mock_client).to receive(:verify_transaction).with(tx_ref).and_return(
          success: true,
          status: "success",
          tx_ref:,
          amount: BigDecimal("100.00"),
          currency: "USD",
          mode: "test"
        )

        result = subject.perform
        expect(result[:success]).to be false
        expect(result[:error]).to include("Currency mismatch")
        expect(chapa_tx.reload.status).to eq("failed")
      end

      it "rejects amount mismatch" do
        allow(mock_client).to receive(:verify_transaction).with(tx_ref).and_return(
          success: true,
          status: "success",
          tx_ref:,
          amount: BigDecimal("50.00"),
          currency: "ETB",
          mode: "test"
        )

        result = subject.perform
        expect(result[:success]).to be false
        expect(result[:error]).to include("Amount mismatch")
        expect(chapa_tx.reload.status).to eq("failed")
      end

      it "rejects tx_ref mismatch" do
        allow(mock_client).to receive(:verify_transaction).with(tx_ref).and_return(
          success: true,
          status: "success",
          tx_ref: "different_ref",
          reference: "chp_123",
          amount: BigDecimal("100.00"),
          currency: "ETB",
          mode: "test"
        )

        result = subject.perform
        expect(result[:success]).to be false
        expect(result[:error]).to include("reference mismatch")
      end

      it "rejects test mode in production environment" do
        allow(Rails.env).to receive(:production?).and_return(true)
        allow(mock_client).to receive(:verify_transaction).with(tx_ref).and_return(
          success: true,
          status: "success",
          tx_ref:,
          reference: "chp_123",
          amount: BigDecimal("100.00"),
          currency: "ETB",
          mode: "test"
        )

        result = subject.perform
        expect(result[:success]).to be false
        expect(result[:error]).to include("Test mode transaction received in production")
      end
    end

    # Five-check rejection matrix: each example exercises one of the five integrity gates
    # in validate_verification_integrity! (or the upstream success guard). A buyer must
    # never receive access from a failed, tampered, or short payment.
    context "five-check rejection matrix" do
      # Purchase is 100.00 ETB = 10_000 santims.

      it "rejects amount short by 0.01 ETB (9_999 vs 10_000 santims)" do
        allow(mock_client).to receive(:verify_transaction).with(tx_ref).and_return(
          success: true,
          status: "success",
          tx_ref:,
          reference: "chp_ref_ok",
          amount: BigDecimal("99.99"),   # 9_999 santims — 1 santim short
          currency: "ETB",
          mode: "test"
        )

        result = subject.perform

        expect(result[:success]).to be false
        expect(result[:error]).to include("Amount mismatch")
        expect(result[:error]).to include("9999")
        expect(chapa_tx.reload.status).to eq("failed")
        expect(purchase.reload.in_progress?).to be true
      end

      it "rejects wrong currency (USD instead of ETB)" do
        allow(mock_client).to receive(:verify_transaction).with(tx_ref).and_return(
          success: true,
          status: "success",
          tx_ref:,
          reference: "chp_ref_ok",
          amount: BigDecimal("100.00"),
          currency: "USD",
          mode: "test"
        )

        result = subject.perform

        expect(result[:success]).to be false
        expect(result[:error]).to match(/Currency mismatch.*USD/i)
        expect(chapa_tx.reload.status).to eq("failed")
        expect(purchase.reload.in_progress?).to be true
      end

      it "rejects wrong tx_ref returned by gateway" do
        allow(mock_client).to receive(:verify_transaction).with(tx_ref).and_return(
          success: true,
          status: "success",
          tx_ref: "arifdrop-other-order-aabbcc",
          reference: "chp_ref_ok",
          amount: BigDecimal("100.00"),
          currency: "ETB",
          mode: "test"
        )

        result = subject.perform

        expect(result[:success]).to be false
        expect(result[:error]).to match(/reference mismatch/i)
        expect(purchase.reload.in_progress?).to be true
      end

      it "rejects test-mode transaction received in production config" do
        allow(Rails.env).to receive(:production?).and_return(true)
        allow(mock_client).to receive(:verify_transaction).with(tx_ref).and_return(
          success: true,
          status: "success",
          tx_ref:,
          reference: "chp_ref_ok",
          amount: BigDecimal("100.00"),
          currency: "ETB",
          mode: "test"           # test key in production — must be rejected
        )

        result = subject.perform

        expect(result[:success]).to be false
        expect(result[:error]).to match(/test mode.*production/i)
        expect(purchase.reload.in_progress?).to be true
      end

      it "rejects non-success status returned by gateway (e.g. failed payment)" do
        allow(mock_client).to receive(:verify_transaction).with(tx_ref).and_return(
          success: false,
          status: "failed",
          error: "Payment declined by issuing bank"
        )

        result = subject.perform

        # Gateway returned success:false — the service must surface failure
        # and leave the purchase in its unfinalized state.
        expect(result[:success]).to be false
        expect(result[:status]).to eq("failed")
        expect(purchase.reload.in_progress?).to be true
      end
    end

    context "when order is unknown" do
      it "returns error when tx_ref cannot be found" do
        service = described_class.new(tx_ref: "unknown_ref", client: mock_client)
        result = service.perform
        expect(result[:success]).to be false
        expect(result[:error]).to include("Order not found")
      end
    end
  end
end
