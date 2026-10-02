# frozen_string_literal: true

require "spec_helper"

describe "Admin::Orders GET /admin/orders", type: :request, inertia: true do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:admin_user, name: "Admin Lead") }
  let(:regular_user) { create(:user) }

  before do
    host! DOMAIN
  end

  context "when visitor is not signed in" do
    it "redirects to the login page" do
      get admin_orders_path

      expect(response).to redirect_to(login_path(next: admin_orders_path))
    end
  end

  context "when visitor is signed in as a regular user" do
    before { sign_in regular_user }

    it "redirects to root" do
      get admin_orders_path

      expect(response).to redirect_to(root_path)
    end
  end

  context "when visitor is signed in as an authorized admin team member" do
    before { sign_in admin }

    let!(:seller) { create(:user, name: "Seller One") }
    let!(:product) { create(:product, user: seller, name: "Ruby Book") }
    let!(:order1) do
      create(:purchase, link: product, seller:, email: "buyer1@example.com", purchase_state: "successful", created_at: 2.days.ago)
    end
    let!(:order2) do
      create(:purchase, link: product, seller:, email: "buyer2@example.com", purchase_state: "successful", stripe_refunded: true, created_at: 1.day.ago)
    end

    it "renders the Orders Index page with serialized orders and pagination" do
      get admin_orders_path, headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["component"]).to eq("Admin/Orders/Index")

      props = body["props"]
      expect(props).to have_key("orders")
      expect(props).to have_key("pagination")
      expect(props).to have_key("filters")
      expect(props).to have_key("current_admin")

      order_emails = props["orders"].map { |o| o["customer_email"] }
      expect(order_emails).to include("buyer1@example.com", "buyer2@example.com")
    end

    it "filters orders by email when search query contains @" do
      get admin_orders_path(q: "buyer1@example.com"), headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      props = JSON.parse(response.body)["props"]
      order_emails = props["orders"].map { |o| o["customer_email"] }
      expect(order_emails).to include("buyer1@example.com")
      expect(order_emails).not_to include("buyer2@example.com")
      expect(props["filters"]["q"]).to eq("buyer1@example.com")
    end

    it "filters orders by query when search query does not contain @" do
      get admin_orders_path(q: order1.external_id), headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      props = JSON.parse(response.body)["props"]
      order_ids = props["orders"].map { |o| o["id"] }
      expect(order_ids).to include(order1.external_id)
      expect(props["filters"]["q"]).to eq(order1.external_id)
    end

    it "filters orders by status" do
      get admin_orders_path(status: "refunded"), headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      props = JSON.parse(response.body)["props"]
      order_emails = props["orders"].map { |o| o["customer_email"] }
      expect(order_emails).to include("buyer2@example.com")
      expect(order_emails).not_to include("buyer1@example.com")
      expect(props["filters"]["status"]).to eq("refunded")
    end

    it "filters orders by date" do
      target_date = 2.days.ago.to_date.strftime("%Y-%m-%d")
      get admin_orders_path(date: target_date), headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      props = JSON.parse(response.body)["props"]
      order_emails = props["orders"].map { |o| o["customer_email"] }
      expect(order_emails).to include("buyer1@example.com")
      expect(props["filters"]["date"]).to eq(target_date)
    end

    it "handles search service errors gracefully" do
      allow_any_instance_of(AdminSearchService).to receive(:search_purchases)
        .and_raise(AdminSearchService::InsufficientSearchCriteriaError)

      get admin_orders_path(q: "abc"), headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      props = JSON.parse(response.body)["props"]
      expect(props["orders"]).to eq([])
      expect(props["pagination"]["count"]).to eq(0)
    end
  end
end
