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
    let(:tx_ref) { "4FGFF4FFGD3" }
    let(:reference) { "AP634JFwEbxd" }
    let!(:chapa_tx) do
      ChapaTransaction.create!(
        tx_ref:,
        chapa_reference: reference,
        order:,
        purchase:,
        amount_santims: 100_00,
        amount_decimal: BigDecimal("100.00"),
        currency: "ETB",
        status: "pending"
      )
    end
    let(:client) { instance_double(Chapa::Client) }

    before do
      allow(Chapa::Client).to receive(:new).and_return(client)
    end

    it "processes documented charge.success payload via FinalizerService" do
      sample_payload = {
        "event" => "charge.success",
        "first_name" => "",
        "last_name" => "",
        "email" => nil,
        "mobile" => "25190000000",
        "currency" => "ETB",
        "amount" => "400.00",
        "charge" => "12.00",
        "status" => "success",
        "mode" => "live",
        "reference" => reference,
        "type" => "API",
        "tx_ref" => tx_ref,
        "payment_method" => "telebirr"
      }
      event = ChapaWebhookEvent.create!(
        idempotency_key: "evt_doc_sample_1",
        event_type: "charge.success",
        tx_ref:,
        raw_payload: sample_payload.to_json,
        status: "received"
      )

      finalizer = instance_double(Chapa::FinalizerService)
      allow(Chapa::FinalizerService).to receive(:new).with(tx_ref:, client:).and_return(finalizer)
      allow(finalizer).to receive(:perform).and_return(success: true, status: "success")

      described_class.new.perform(event.id)

      expect(event.reload.status).to eq("processed")
    end

    it "processes documented charge.refunded payload, re-verifies via API, and marks refunded" do
      sample_payload = {
        "event" => "charge.refunded",
        "currency" => "ETB",
        "amount" => "400.00",
        "status" => "refunded",
        "mode" => "live",
        "reference" => reference,
        "tx_ref" => tx_ref
      }
      event = ChapaWebhookEvent.create!(
        idempotency_key: "evt_doc_sample_refund",
        event_type: "charge.refunded",
        tx_ref:,
        raw_payload: sample_payload.to_json,
        status: "received"
      )

      allow(client).to receive(:verify_transaction).with(tx_ref).and_return(
        success: true,
        status: "refunded",
        reference:
      )

      described_class.new.perform(event.id)

      expect(event.reload.status).to eq("processed")
      expect(chapa_tx.reload.status).to eq("refunded")
      expect(purchase.reload.stripe_refunded).to be true
    end

    it "processes documented charge.reversed payload, re-verifies via API, and executes full refund lifecycle" do
      sample_payload = {
        "event" => "charge.reversed",
        "status" => "reversed",
        "reference" => reference,
        "tx_ref" => tx_ref
      }
      event = ChapaWebhookEvent.create!(
        idempotency_key: "evt_doc_sample_reversed",
        event_type: "charge.reversed",
        tx_ref:,
        raw_payload: sample_payload.to_json,
        status: "received"
      )

      allow(client).to receive(:verify_transaction).with(tx_ref).and_return(
        success: true,
        status: "reversed",
        reference:
      )
      allow(ErrorNotifier).to receive(:notify)

      expect do
        described_class.new.perform(event.id)
      end.to change { purchase.reload.stripe_refunded? }.from(false).to(true)
        .and change { BalanceTransaction.where(user: seller).count }.by_at_least(1)
        .and have_enqueued_mail(CustomerMailer, :refund).with(purchase.email, product.id, purchase.id)

      expect(event.reload.status).to eq("processed")
      expect(chapa_tx.reload.status).to eq("reversed")
      expect(seller.balance_transactions.where(refund: purchase.refunds.last).first.holding_amount_net_cents).to be_negative
      expect(ErrorNotifier).to have_received(:notify).with(
        "Chapa transaction reversed",
        context: {
          tx_ref:,
          chapa_reference: reference,
          purchase_id: purchase.id,
          order_id: chapa_tx.order_id
        }
      )
    end

    it "processes documented charge.failed/cancelled payload and updates transaction status" do
      sample_payload = {
        "event" => "charge.failed/cancelled",
        "status" => "failed",
        "reference" => reference,
        "tx_ref" => tx_ref
      }
      event = ChapaWebhookEvent.create!(
        idempotency_key: "evt_doc_sample_failed",
        event_type: "charge.failed/cancelled",
        tx_ref:,
        raw_payload: sample_payload.to_json,
        status: "received"
      )

      allow(client).to receive(:verify_transaction).with(tx_ref).and_return(
        success: false,
        status: "failed"
      )

      described_class.new.perform(event.id)

      expect(event.reload.status).to eq("processed")
      expect(chapa_tx.reload.status).to eq("failed")
    end

    it "safely acknowledges unknown events with log line and marks processed" do
      sample_payload = {
        "event" => "payout.success",
        "type" => "Payout",
        "status" => "success",
        "reference" => "MYMER3434989"
      }
      event = ChapaWebhookEvent.create!(
        idempotency_key: "evt_unknown_payout",
        event_type: "payout.success",
        tx_ref: nil,
        raw_payload: sample_payload.to_json,
        status: "received"
      )

      allow(Rails.logger).to receive(:info).and_call_original
      expect(Rails.logger).to receive(:info).with(/Acknowledged unknown event/).and_call_original

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
