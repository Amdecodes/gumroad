# frozen_string_literal: true

require "spec_helper"

describe "Admin::Customers", type: :request, inertia: true do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:admin_user, name: "Admin Lead", email: "admin@gumroad.com") }
  let(:regular_user) { create(:user) }
  let(:seller) { create(:user, name: "Seller Star") }
  let(:buyer) { create(:user, name: "Buyer Abebe", email: "abebe@example.com") }
  let(:product) { create(:product, user: seller, name: "Addis Guide", price_cents: 3500) }
  let!(:purchase) do
    create(
      :purchase,
      link: product,
      seller:,
      purchaser: buyer,
      email: buyer.email,
      purchase_state: "successful",
      price_cents: 3500,
      displayed_price_currency_type: "etb"
    )
  end

  before do
    host! DOMAIN
    stub_const("GUMROAD_ADMIN_ID", admin.id)
  end

  describe "GET /admin/customers" do
    context "when visitor is not signed in" do
      it "redirects to the login page" do
        get admin_customers_path

        expect(response).to redirect_to(login_path(next: admin_customers_path))
      end
    end

    context "when visitor is signed in as a regular user" do
      before { sign_in regular_user }

      it "redirects to root" do
        get admin_customers_path

        expect(response).to redirect_to(root_path)
      end
    end

    context "when visitor is signed in as an authorized admin team member" do
      before { sign_in admin }

      it "renders the index page with customers list and statistics" do
        get admin_customers_path, headers: { "X-Inertia" => "true" }

        expect(response).to have_http_status(:ok)
        props = JSON.parse(response.body)["props"]

        expect(props["customers"]).to be_an(Array)
        expect(props["customers"].first).to include(
          "email" => buyer.email,
          "name" => buyer.name,
          "orders_count" => 1,
          "is_registered" => true
        )
        expect(props["pagination"]).to include("page" => 1, "count" => 1)
      end

      it "searches customers by email query" do
        get admin_customers_path, params: { q: "abebe" }, headers: { "X-Inertia" => "true" }

        expect(response).to have_http_status(:ok)
        props = JSON.parse(response.body)["props"]

        expect(props["customers"].first["email"]).to eq(buyer.email)
      end
    end
  end

  describe "GET /admin/customers/:id" do
    context "when visitor is signed in as an authorized admin team member" do
      before { sign_in admin }

      it "renders the customer show page with purchases, subscriptions, and access details" do
        get admin_customer_path(buyer.external_id), headers: { "X-Inertia" => "true" }

        expect(response).to have_http_status(:ok)
        props = JSON.parse(response.body)["props"]

        expect(props["customer"]).to include(
          "email" => buyer.email,
          "name" => buyer.name,
          "orders_count" => 1
        )
        expect(props["purchases"]).to be_an(Array)
        expect(props["purchases"].first).to include(
          "id" => purchase.external_id,
          "product_name" => "Addis Guide",
          "status" => "successful"
        )
      end

      it "finds customer by email or purchase ID" do
        get admin_customer_path(purchase.external_id), headers: { "X-Inertia" => "true" }

        expect(response).to have_http_status(:ok)
        props = JSON.parse(response.body)["props"]
        expect(props["customer"]["email"]).to eq(buyer.email)
      end

      it "redirects when customer is not found" do
        get admin_customer_path("non_existent_customer_id")

        expect(response).to redirect_to(admin_customers_path)
        expect(flash[:alert]).to eq("Customer not found")
      end
    end
  end
end
