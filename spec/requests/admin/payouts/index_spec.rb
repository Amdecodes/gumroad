# frozen_string_literal: true

require "spec_helper"

describe "Admin::Payouts GET /admin/payouts", type: :request, inertia: true do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:admin_user, name: "Admin Lead") }
  let(:regular_user) { create(:user) }

  before do
    host! DOMAIN
  end

  context "when visitor is not signed in" do
    it "redirects to the login page" do
      get admin_payouts_path

      expect(response).to redirect_to(login_path(next: admin_payouts_path))
    end
  end

  context "when visitor is signed in as a regular user" do
    before { sign_in regular_user }

    it "redirects to root" do
      get admin_payouts_path

      expect(response).to redirect_to(root_path)
    end
  end

  context "when visitor is signed in as an authorized admin team member" do
    before { sign_in admin }

    let!(:seller) { create(:compliant_user, name: "Alice Seller", username: "aliceseller", email: "alice@example.com") }
    let!(:completed_payment) do
      create(
        :payment_completed,
        user: seller,
        amount_cents: 25_000,
        txn_id: "tx_completed_123",
        created_at: 2.days.ago
      )
    end
    let!(:pending_scheduled_payout) do
      create(
        :scheduled_payout,
        user: seller,
        payout_amount_cents: 15_000,
        status: "pending",
        created_at: 1.day.ago
      )
    end

    it "renders the Payouts Index page with serialized payouts, metrics, and pagy metadata" do
      get admin_payouts_path, headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["component"]).to eq("Admin/Payouts/Index")

      props = body["props"]
      expect(props).to have_key("payouts")
      expect(props).to have_key("pagy")
      expect(props).to have_key("metrics")
      expect(props).to have_key("filters")
      expect(props).to have_key("current_admin")

      expect(props["metrics"]).to include(
        "pending_count" => 1,
        "completed_count_30d" => 1
      )

      references = props["payouts"].map { |p| p["reference"] }
      expect(references).to include("tx_completed_123", pending_scheduled_payout.external_id)
    end

    it "filters payouts by pending status" do
      get admin_payouts_path(status: "pending"), headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      statuses = body["props"]["payouts"].map { |p| p["status"] }
      expect(statuses).to all(eq("pending"))
      expect(body["props"]["payouts"].length).to eq(1)
      expect(body["props"]["payouts"].first["reference"]).to eq(pending_scheduled_payout.external_id)
    end

    it "filters payouts by completed status" do
      get admin_payouts_path(status: "completed"), headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      statuses = body["props"]["payouts"].map { |p| p["status"] }
      expect(statuses).to all(eq("completed"))
      expect(body["props"]["payouts"].first["reference"]).to eq("tx_completed_123")
    end

    it "searches payouts by creator email" do
      get admin_payouts_path(q: "alice@example.com"), headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["props"]["payouts"].length).to be >= 1
      expect(body["props"]["payouts"].first["creator"]["email"]).to eq("alice@example.com")
    end

    it "searches payouts by creator username with @ prefix" do
      get admin_payouts_path(q: "@aliceseller"), headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["props"]["payouts"].length).to be >= 1
      expect(body["props"]["payouts"].first["creator"]["username"]).to eq("aliceseller")
    end

    it "searches payouts by reference" do
      get admin_payouts_path(q: "tx_completed_123"), headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["props"]["payouts"].length).to eq(1)
      expect(body["props"]["payouts"].first["reference"]).to eq("tx_completed_123")
    end
  end
end
