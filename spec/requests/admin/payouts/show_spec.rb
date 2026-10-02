# frozen_string_literal: true

require "spec_helper"

describe "Admin::Payouts GET /admin/payouts/:id", type: :request, inertia: true do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:admin_user, name: "Admin Lead") }
  let(:regular_user) { create(:user) }
  let(:seller) { create(:compliant_user, name: "Bob Creator", username: "bobcreator", email: "bob@example.com") }

  let(:scheduled_payout) do
    create(
      :scheduled_payout,
      user: seller,
      payout_amount_cents: 18_500,
      status: "pending",
      delay_days: 14
    )
  end

  let(:completed_payment) do
    create(
      :payment_completed,
      user: seller,
      amount_cents: 50_000,
      txn_id: "tx_paypal_789",
      processor_fee_cents: 250,
      bank_account: create(:ach_account_stripe_succeed, user: seller)
    )
  end

  before do
    host! DOMAIN
  end

  context "when visitor is not signed in" do
    it "redirects to the login page" do
      get admin_payout_path(scheduled_payout.external_id)

      expect(response).to redirect_to(login_path(next: admin_payout_path(scheduled_payout.external_id)))
    end
  end

  context "when visitor is signed in as a regular user" do
    before { sign_in regular_user }

    it "redirects to root" do
      get admin_payout_path(scheduled_payout.external_id)

      expect(response).to redirect_to(root_path)
    end
  end

  context "when signed in as an authorized admin team member" do
    before { sign_in admin }

    it "returns 404 for a non-existent payout identifier" do
      get admin_payout_path("non-existent-payout-id")

      expect(response).to have_http_status(:not_found)
    end

    it "renders the detail page for a scheduled payout with proper props and action flags" do
      get admin_payout_path(scheduled_payout.external_id), headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["component"]).to eq("Admin/Payouts/Show")

      props = body["props"]
      expect(props).to have_key("payout")
      expect(props).to have_key("creator")
      expect(props).to have_key("destination")
      expect(props).to have_key("breakdown")
      expect(props).to have_key("audit_history")
      expect(props).to have_key("current_admin")

      expect(props["payout"]["external_id"]).to eq(scheduled_payout.external_id)
      expect(props["payout"]["status"]).to eq("pending")
      expect(props["payout"]["can_mark_paid"]).to be(true)
      expect(props["payout"]["can_cancel"]).to be(true)
      expect(props["creator"]["email"]).to eq("bob@example.com")
    end

    it "renders the detail page for an executed payment transfer" do
      get admin_payout_path(completed_payment.external_id), headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["component"]).to eq("Admin/Payouts/Show")

      props = body["props"]
      expect(props["payout"]["external_id"]).to eq(completed_payment.external_id)
      expect(props["payout"]["status"]).to eq("completed")
      expect(props["payout"]["can_mark_paid"]).to be(false)
      expect(props["payout"]["can_cancel"]).to be(false)
      expect(props["destination"]["account_number_visual"]).to be_present
      expect(props["breakdown"]["processor_fee_cents"]).to eq(250)
    end
  end
end
