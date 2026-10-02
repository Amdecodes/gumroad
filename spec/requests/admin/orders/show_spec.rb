# frozen_string_literal: true

require "spec_helper"

describe "Admin::Orders GET /admin/orders/:id", type: :request, inertia: true do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:admin_user, name: "Admin Lead") }
  let(:regular_user) { create(:user) }
  let(:seller) { create(:user, name: "Top Creator") }
  let(:product) { create(:product, user: seller, name: "Premium Course", price_cents: 9900) }
  let(:purchaser) { create(:user, name: "Alex Buyer") }
  let(:purchase) do
    create(
      :purchase,
      link: product,
      seller:,
      purchaser:,
      email: "alex@example.com",
      price_cents: 9900,
      purchase_state: "successful"
    )
  end

  before do
    host! DOMAIN
  end

  context "when visitor is not signed in" do
    it "redirects to the login page" do
      get admin_order_path(purchase.external_id)

      expect(response).to redirect_to(login_path(next: admin_order_path(purchase.external_id)))
    end
  end

  context "when visitor is signed in as a regular user" do
    before { sign_in regular_user }

    it "redirects to root" do
      get admin_order_path(purchase.external_id)

      expect(response).to redirect_to(root_path)
    end
  end

  context "when visitor is signed in as an authorized admin team member" do
    before { sign_in admin }

    it "redirects to orders list with an alert when order is not found" do
      get admin_order_path("non_existent_id")

      expect(response).to redirect_to(admin_orders_path)
      expect(flash[:alert]).to eq("Order not found")
    end

    it "renders the Order Show page with serialized detail fields" do
      get admin_order_path(purchase.external_id), headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["component"]).to eq("Admin/Orders/Show")

      order_props = body["props"]["order"]
      expect(order_props["id"]).to eq(purchase.external_id)
      expect(order_props["external_id_numeric"]).to eq(purchase.external_id_numeric.to_s)
      expect(order_props["customer_email"]).to eq("alex@example.com")
      expect(order_props["customer_name"]).to eq("Alex Buyer")
      expect(order_props["product_name"]).to eq("Premium Course")
      expect(order_props["seller"]["name"]).to eq("Top Creator")
      expect(order_props["status"]).to eq("successful")
      expect(order_props["price_cents"]).to eq(9900)
      expect(order_props["currency"]).to eq("USD")
      expect(order_props["access"]["receipt_url"]).to be_present
    end

    it "includes subscription and license details when present" do
      subscription = create(:subscription, user: purchaser, link: product)
      purchase.subscription = subscription
      purchase.is_original_subscription_purchase = true
      purchase.save(validate: false)

      license = create(:license, purchase:)

      get admin_order_path(purchase.external_id), headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      order_props = JSON.parse(response.body)["props"]["order"]

      expect(order_props["subscription"]).to be_present
      expect(order_props["subscription"]["is_active"]).to be(true)
      expect(order_props["subscription"]["status"]).to eq("active")

      expect(order_props["license"]).to be_present
      expect(order_props["license"]["serial"]).to eq(license.serial)
    end
  end
end
