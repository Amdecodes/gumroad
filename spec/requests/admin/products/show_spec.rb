# frozen_string_literal: true

require "spec_helper"

describe "Admin::Products GET /admin/products/:id", type: :request, inertia: true do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:admin_user, name: "Admin Lead", email: "lead@gumroad.com") }
  let(:regular_user) { create(:user) }
  let(:seller) { create(:user, name: "Top Creator", username: "creatortop", email: "creator@example.com") }
  let(:product) { create(:product, user: seller, name: "Mastering TypeScript", price_cents: 8900) }

  before do
    host! DOMAIN
    stub_const("GUMROAD_ADMIN_ID", admin.id)
  end

  context "when visitor is not signed in" do
    it "redirects to the login page" do
      get admin_product_path(product.unique_permalink)

      expect(response).to redirect_to(login_path(next: admin_product_path(product.unique_permalink)))
    end
  end

  context "when visitor is signed in as a regular user" do
    before { sign_in regular_user }

    it "redirects to root" do
      get admin_product_path(product.unique_permalink)

      expect(response).to redirect_to(root_path)
    end
  end

  context "when visitor is signed in as an authorized admin team member" do
    before { sign_in admin }

    it "returns 404 when product is not found" do
      get admin_product_path("nonexistent-slug-xyz")

      expect(response).to redirect_to(admin_products_path)
      follow_redirect!
      expect(response.body).to include("Product not found")
    end

    it "renders the show page using unique_permalink" do
      get admin_product_path(product.unique_permalink), headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      props = JSON.parse(response.body)["props"]
      expect(props["product"]["name"]).to eq("Mastering TypeScript")
      expect(props["product"]["price_cents"]).to eq(8900)
      expect(props["creator"]["name"]).to eq("Top Creator")
      expect(props["creator"]["username"]).to eq("creatortop")
      expect(props["metrics"]).to include("gross_sales_cents", "units_sold", "refund_rate", "customer_count")
    end

    it "renders the show page using external_id" do
      get admin_product_path(product.external_id), headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      props = JSON.parse(response.body)["props"]
      expect(props["product"]["name"]).to eq("Mastering TypeScript")
    end
  end
end
