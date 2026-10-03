# frozen_string_literal: true

require "spec_helper"

describe "Admin::Reports GET /admin/reports", type: :request, inertia: true do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:admin_user, name: "Admin Lead", email: "lead@gumroad.com") }
  let(:regular_user) { create(:user) }

  before do
    host! DOMAIN
    stub_const("GUMROAD_ADMIN_ID", admin.id)
  end

  context "when visitor is not signed in" do
    it "redirects to the login page" do
      get admin_reports_path

      expect(response).to redirect_to(login_path(next: admin_reports_path))
    end
  end

  context "when visitor is signed in as a regular user" do
    before { sign_in regular_user }

    it "redirects to root" do
      get admin_reports_path

      expect(response).to redirect_to(root_path)
    end
  end

  context "when visitor is signed in as an authorized admin team member" do
    before { sign_in admin }

    let!(:seller) { create(:user, name: "Star Creator", username: "star") }
    let!(:product) { create(:product, user: seller, name: "Flagship Guide", price_cents: 5000) }
    let!(:order1) do
      create(:purchase, link: product, seller:, price_cents: 5000, purchase_state: "successful", charge_processor_id: "stripe")
    end
    let!(:order2) do
      create(:purchase, link: product, seller:, price_cents: 5000, purchase_state: "successful", charge_processor_id: "paypal", stripe_refunded: true)
    end

    it "renders the reports page with accurate metrics and aggregations" do
      get admin_reports_path, headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      props = JSON.parse(response.body)["props"]

      expect(props["metrics"]).to include(
        "gross_volume_cents",
        "formatted_gross_volume",
        "total_orders",
        "average_order_value_cents",
        "refund_rate"
      )

      expect(props["trend"]["points"]).to be_an(Array)
      expect(props["trend"]["range"]).to eq(30)

      expect(props["top_products"]).to be_an(Array)
      top_p = props["top_products"].find { |p| p["id"] == product.external_id }
      expect(top_p).to be_present
      expect(top_p["name"]).to eq("Flagship Guide")

      expect(props["top_creators"]).to be_an(Array)
      top_c = props["top_creators"].find { |c| c["id"] == seller.external_id }
      expect(top_c).to be_present
      expect(top_c["name"]).to eq("Star Creator")

      expect(props["payment_methods"]).to be_an(Array)
    end

    it "supports custom time ranges like 7 days" do
      get admin_reports_path, params: { range: 7 }, headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      props = JSON.parse(response.body)["props"]
      expect(props["selected_range"]).to eq(7)
      expect(props["trend"]["range"]).to eq(7)
      expect(props["trend"]["points"].length).to eq(7)
    end
  end
end
