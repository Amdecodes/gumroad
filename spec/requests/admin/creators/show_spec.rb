# frozen_string_literal: true

require "spec_helper"

describe "Admin::Creators GET /admin/creators/:id", type: :request, inertia: true do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:admin_user, name: "Admin Lead") }
  let(:regular_user) { create(:user) }
  let(:creator) { create(:user, name: "Dev Creator", username: "devcreator", email: "creator@example.com", bio: "Building cool things") }
  let!(:product) { create(:product, user: creator, name: "Cool App", price_cents: 1500) }
  let!(:sale) { create(:purchase, link: product, seller: creator, price_cents: 1500, purchase_state: "successful") }

  before do
    host! DOMAIN
  end

  context "when visitor is not signed in" do
    it "redirects to the login page" do
      get admin_creator_path(creator.external_id)

      expect(response).to redirect_to(login_path(next: admin_creator_path(creator.external_id)))
    end
  end

  context "when visitor is signed in as a regular user" do
    before { sign_in regular_user }

    it "redirects to root" do
      get admin_creator_path(creator.external_id)

      expect(response).to redirect_to(root_path)
    end
  end

  context "when visitor is signed in as an authorized admin team member" do
    before { sign_in admin }

    it "renders the Creator Show page when found by external_id" do
      get admin_creator_path(creator.external_id), headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["component"]).to eq("Admin/Creators/Show")

      props = body["props"]
      expect(props).to have_key("profile")
      expect(props).to have_key("metrics")
      expect(props).to have_key("products")
      expect(props).to have_key("payment_info")
      expect(props).to have_key("impersonate_url")
      expect(props).to have_key("audit_history")
      expect(props).to have_key("current_admin")

      profile = props["profile"]
      expect(profile["external_id"]).to eq(creator.external_id)
      expect(profile["username"]).to eq("devcreator")
      expect(profile["display_name"]).to eq("Dev Creator")
      expect(profile["email"]).to eq("creator@example.com")
      expect(profile["bio"]).to eq("Building cool things")
      expect(profile["status"]).to eq("active")

      metrics = props["metrics"]
      expect(metrics["sales_count"]).to eq(1)
      expect(metrics["lifetime_revenue_cents"]).to eq(1500)
      expect(metrics["active_products_count"]).to eq(1)

      products = props["products"]
      expect(products.size).to eq(1)
      expect(products.first["title"]).to eq("Cool App")

      expect(props["impersonate_url"]).to eq("/admin/impersonate?user_id=#{creator.external_id}")
    end

    it "renders the Creator Show page when found by username" do
      get admin_creator_path("devcreator"), headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["props"]["profile"]["external_id"]).to eq(creator.external_id)
    end

    it "returns 404 when creator is not found" do
      get admin_creator_path("non_existent_creator")

      expect(response).to have_http_status(:not_found)
    end
  end
end
