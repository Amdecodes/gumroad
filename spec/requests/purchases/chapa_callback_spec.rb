# frozen_string_literal: true

require "spec_helper"

RSpec.describe "GET /purchases/:id/chapa_callback" do
  let(:seller) { create(:user) }
  let(:product) { create(:product, user: seller, price_currency_type: "etb") }
  let(:tx_ref) { "arifdrop-callback-test-123" }
  let(:order) { create(:order) }
  let(:purchase) do
    create(
      :purchase,
      link: product,
      seller:,
      price_cents: 15000,
      displayed_price_cents: 15000,
      displayed_price_currency_type: "etb",
      email: "buyer@example.com",
      purchase_state: "in_progress",
      charge_processor_id: "chapa",
      processor_payment_intent_id: tx_ref,
      stripe_transaction_id: tx_ref,
      order:
    )
  end

  before do
    host! DOMAIN
  end

  context "when purchase has already been finalized by webhook" do
    before do
      purchase.update_columns(purchase_state: "successful")
    end

    it "redirects directly to the purchase receipt" do
      get chapa_callback_purchase_path(purchase.external_id)

      expect(response).to redirect_to(receipt_purchase_path(purchase.external_id, email: purchase.email))
    end
  end

  context "when purchase is still pending upon user return" do
    it "performs server-to-server verification fallback and finalizes on valid confirmation" do
      allow_any_instance_of(Chapa::Client).to receive(:verify_transaction)
        .with(tx_ref)
        .and_return({
                      success: true,
                      status: "success",
                      amount: 150.00,
                      currency: "ETB",
                      reference: "CHAPA_CALLBACK_REF_11",
                      tx_ref:
                    })

      expect do
        get chapa_callback_purchase_path(purchase.external_id)
      end.to change { purchase.reload.purchase_state }.from("in_progress").to("successful")

      expect(response).to redirect_to(receipt_purchase_path(purchase.external_id, email: purchase.email))
      expect(purchase.reload.stripe_transaction_id).to eq("CHAPA_CALLBACK_REF_11")
    end

    it "does NOT mark paid solely based on URL query parameters if server check fails" do
      allow_any_instance_of(Chapa::Client).to receive(:verify_transaction)
        .with(tx_ref)
        .and_return({
                      success: false,
                      status: "pending",
                      error: "Transaction not completed"
                    })

      # Attacker sends ?status=success in URL query parameters
      get chapa_callback_purchase_path(purchase.external_id, status: "success")

      expect(purchase.reload.purchase_state).to eq("in_progress")
      expect(response).to redirect_to(confirm_receipt_email_purchase_path(purchase.external_id))
      expect(flash[:notice]).to include("currently being processed")
    end
  end
end
