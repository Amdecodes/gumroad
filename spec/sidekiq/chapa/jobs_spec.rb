# frozen_string_literal: true

require "spec_helper"

describe "Chapa Background Jobs" do
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
      charge_processor_id: "chapa"
    )
  end

  describe Chapa::ReconcilePendingTransactionsJob do
    let!(:old_tx) do
      ChapaTransaction.create!(
        tx_ref: "chk_reconcile_1",
        order:,
        purchase:,
        amount_santims: 100_00,
        amount_decimal: BigDecimal("100.00"),
        currency: "ETB",
        status: "pending",
        created_at: 10.minutes.ago
      )
    end
    let!(:recent_tx) do
      ChapaTransaction.create!(
        tx_ref: "chk_reconcile_2",
        order:,
        purchase:,
        amount_santims: 100_00,
        amount_decimal: BigDecimal("100.00"),
        currency: "ETB",
        status: "pending",
        created_at: 1.minute.ago
      )
    end

    it "reconciles only pending transactions older than 5 minutes" do
      finalizer = instance_double(Chapa::FinalizerService)
      allow(Chapa::FinalizerService).to receive(:new).with(tx_ref: "chk_reconcile_1").and_return(finalizer)
      expect(finalizer).to receive(:perform).and_return(success: true, status: "success")

      expect(Chapa::FinalizerService).not_to receive(:new).with(tx_ref: "chk_reconcile_2")

      described_class.new.perform
    end
  end

  describe Chapa::ExpireAbandonedTransactionsJob do
    let!(:abandoned_tx) do
      ChapaTransaction.create!(
        tx_ref: "chk_abandoned_1",
        order:,
        purchase:,
        amount_santims: 100_00,
        amount_decimal: BigDecimal("100.00"),
        currency: "ETB",
        status: "pending",
        created_at: 2.hours.ago,
        expires_at: 1.hour.ago
      )
    end

    it "performs a final verification and expires transaction if still unverified" do
      finalizer = instance_double(Chapa::FinalizerService)
      allow(Chapa::FinalizerService).to receive(:new).with(tx_ref: "chk_abandoned_1").and_return(finalizer)
      allow(finalizer).to receive(:perform).and_return(success: false, status: "failed")

      described_class.new.perform

      expect(abandoned_tx.reload.status).to eq("expired")
    end
  end

  describe Chapa::ProcessWebhookJob do
    let!(:event) do
      ChapaWebhookEvent.create!(
        idempotency_key: "evt_test_123",
        event_type: "charge.complete",
        tx_ref: "chk_wh_proc_1",
        raw_payload: { tx_ref: "chk_wh_proc_1" }.to_json,
        status: "received"
      )
    end

    it "processes event via FinalizerService and marks event processed" do
      finalizer = instance_double(Chapa::FinalizerService)
      allow(Chapa::FinalizerService).to receive(:new).with(tx_ref: "chk_wh_proc_1").and_return(finalizer)
      allow(finalizer).to receive(:perform).and_return(success: true, status: "success")

      described_class.new.perform(event.id)

      expect(event.reload.status).to eq("processed")
    end
  end

  describe Chapa::PollRefundStatusJob do
    let(:refund_service) { instance_double(Chapa::RefundService) }

    before do
      allow(Chapa::RefundService).to receive(:new).with(
        purchase:,
        amount_cents: 100_00,
        reason: "reason",
        admin_user: nil
      ).and_return(refund_service)
    end

    it "finalizes refund when polling returns completed" do
      allow(refund_service).to receive(:check_and_finalize_refund).with("ref_123", 100_00).and_return(
        success: true,
        status: "refunded"
      )

      described_class.new.perform("ref_123", purchase.id, 100_00, "reason", nil)
    end

    it "reschedules polling if status is still pending or processing" do
      allow(refund_service).to receive(:check_and_finalize_refund).with("ref_123", 100_00).and_return(
        success: false,
        status: "processing"
      )
      allow(described_class).to receive(:perform_in)

      described_class.new.perform("ref_123", purchase.id, 100_00, "reason", nil)

      expect(described_class).to have_received(:perform_in).with(
        1.minute,
        "ref_123",
        purchase.id,
        100_00,
        "reason",
        nil
      )
    end
  end
end
