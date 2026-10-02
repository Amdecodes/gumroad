# frozen_string_literal: true

require "spec_helper"

describe "Admin::Overview", type: :request, inertia: true do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:admin_user, name: "Admin Lead") }
  let(:regular_user) { create(:user) }

  before do
    host! DOMAIN
  end

  describe "GET /admin (authorization)" do
    context "when visitor is not signed in" do
      it "redirects to the login page" do
        get admin_root_path

        expect(response).to redirect_to(login_path(next: admin_root_path))
      end
    end

    context "when visitor is signed in as a regular user" do
      it "redirects to the root page" do
        sign_in regular_user

        get admin_root_path

        expect(response).to redirect_to(root_path)
      end
    end

    context "when visitor is signed in as an authorized admin" do
      before { sign_in admin }

      it "succeeds with 200 OK" do
        get admin_root_path

        expect(response).to have_http_status(:ok)
      end

      it "renders the expected Inertia component and prop structure" do
        get admin_root_path, headers: { "X-Inertia" => "true" }

        expect(response).to be_successful
        body = JSON.parse(response.body)
        expect(body["component"]).to eq("Admin/Overview")

        props = body["props"]
        expect(props).to have_key("metrics")
        expect(props).to have_key("needs_attention")
        expect(props).to have_key("sales_trend")
        expect(props).to have_key("recent_orders")
        expect(props).to have_key("current_admin")
      end

      it "displays real read-only metrics from the database" do
        seller = create(:user)
        product = create(:product, user: seller, price_cents: 2500)
        create(:purchase, link: product, seller:, price_cents: 2500, email: "buyer@example.com")

        get admin_root_path, headers: { "X-Inertia" => "true" }

        props = JSON.parse(response.body)["props"]
        metrics = props["metrics"]

        expect(metrics["revenue"]["cents"]).to be >= 2500
        expect(metrics["orders_count"]).to be >= 1
        expect(metrics["customers_count"]).to be >= 1

        recent_orders = props["recent_orders"]
        expect(recent_orders.any? { |o| o["customer_email"] == "buyer@example.com" }).to be(true)
      end

      it "supports the 7, 30, and 90 days range parameters for sales trends" do
        [7, 30, 90].each do |days|
          get admin_root_path(range: days), headers: { "X-Inertia" => "true" }

          props = JSON.parse(response.body)["props"]
          expect(props["sales_trend"]["selected_range"]).to eq(days)
          expect(props["sales_trend"]["points"].length).to eq(days)
        end
      end
    end
  end

  describe "existing operational tools routes" do
    it "preserves sidekiq route" do
      expect(admin_sidekiq_web_path).to eq("/admin/sidekiq")
    end

    it "preserves features route" do
      expect(admin_flipper_ui_path).to eq("/admin/features")
    end

    it "preserves impersonate route" do
      expect(admin_impersonate_path).to eq("/admin/impersonate")
    end
  end
end
