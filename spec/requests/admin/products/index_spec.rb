# frozen_string_literal: true

require "spec_helper"

describe "Admin::Products GET /admin/products", type: :request, inertia: true do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:admin_user, name: "Admin Lead", email: "lead@gumroad.com") }
  let(:regular_user) { create(:user) }

  before do
    host! DOMAIN
    stub_const("GUMROAD_ADMIN_ID", admin.id)
  end

  context "when visitor is not signed in" do
    it "redirects to the login page" do
      get admin_products_path

      expect(response).to redirect_to(login_path(next: admin_products_path))
    end
  end

  context "when visitor is signed in as a regular user" do
    before { sign_in regular_user }

    it "redirects to root" do
      get admin_products_path

      expect(response).to redirect_to(root_path)
    end
  end

  context "when visitor is signed in as an authorized admin team member" do
    before { sign_in admin }

    let!(:seller) { create(:user, name: "Alice Creator", username: "alice", email: "alice@example.com") }
    let!(:product1) { create(:product, user: seller, name: "Awesome Course", price_cents: 4900, draft: false) }
    let!(:product2) { create(:product, user: seller, name: "Ebook Guide", price_cents: 1500, draft: true) }

    it "renders the Products Index page with serialized products" do
      get admin_products_path, headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      inertia_props = body["props"]
      expect(inertia_props["products"]).to be_an(Array)
      expect(inertia_props["products"].length).to be >= 2

      course = inertia_props["products"].find { |p| p["id"] == product1.external_id }
      expect(course["name"]).to eq("Awesome Course")
      expect(course["price_cents"]).to eq(4900)
      expect(course["creator"]["name"]).to eq("Alice Creator")
      expect(course["creator"]["username"]).to eq("alice")
    end

    it "filters products by status draft" do
      get admin_products_path, params: { status: "draft" }, headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      products = JSON.parse(response.body)["props"]["products"]
      expect(products.all? { |p| p["status"] == "draft" }).to eq(true)
      expect(products.map { |p| p["id"] }).to include(product2.external_id)
      expect(products.map { |p| p["id"] }).not_to include(product1.external_id)
    end

    it "filters products by search query" do
      get admin_products_path, params: { q: "Ebook" }, headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      products = JSON.parse(response.body)["props"]["products"]
      expect(products.length).to eq(1)
      expect(products.first["name"]).to eq("Ebook Guide")
    end

    it "filters products by creator_id" do
      other_seller = create(:user, name: "Bob Seller")
      other_product = create(:product, user: other_seller, name: "Bob Toolkit")

      get admin_products_path, params: { creator_id: seller.external_id }, headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      products = JSON.parse(response.body)["props"]["products"]
      expect(products.map { |p| p["id"] }).to include(product1.external_id)
      expect(products.map { |p| p["id"] }).not_to include(other_product.external_id)
    end
  end
end
