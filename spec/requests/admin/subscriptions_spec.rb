# frozen_string_literal: true

require "spec_helper"

describe "Admin::Subscriptions", type: :request, inertia: true do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:admin_user, name: "Admin Lead", email: "admin@gumroad.com") }
  let(:regular_user) { create(:user) }
  let(:seller) { create(:user, name: "Creator One") }
  let(:buyer) { create(:user, name: "Subscriber One", email: "subscriber@example.com") }
  let(:product) { create(:membership_product, user: seller, name: "Pro Plan", price_cents: 2000) }
  let(:subscription) do
    sub = create(:subscription, link: product, user: buyer, seller:)
    create(:purchase, link: product, seller:, purchaser: buyer, email: buyer.email, subscription: sub, purchase_state: "successful", price_cents: 2000, is_original_subscription_purchase: true)
    sub
  end

  around do |example|
    original = ActionController::Base.allow_forgery_protection
    ActionController::Base.allow_forgery_protection = false
    example.run
  ensure
    ActionController::Base.allow_forgery_protection = original
  end

  before do
    host! DOMAIN
    stub_const("GUMROAD_ADMIN_ID", admin.id)
  end

  describe "GET /admin/subscriptions" do
    context "when visitor is not signed in" do
      it "redirects to the login page" do
        get admin_subscriptions_path

        expect(response).to redirect_to(login_path(next: admin_subscriptions_path))
      end
    end

    context "when visitor is signed in as a regular user" do
      before { sign_in regular_user }

      it "redirects to root" do
        get admin_subscriptions_path

        expect(response).to redirect_to(root_path)
      end
    end

    context "when visitor is signed in as an authorized admin team member" do
      before do
        sign_in admin
        subscription # force creation
      end

      it "renders the index page with subscriptions and pagination props" do
        get admin_subscriptions_path, headers: { "X-Inertia" => "true" }

        expect(response).to have_http_status(:ok)
        props = JSON.parse(response.body)["props"]

        expect(props["subscriptions"]).to be_an(Array)
        expect(props["subscriptions"].first).to include(
          "id" => subscription.external_id,
          "product_name" => "Pro Plan",
          "subscriber_email" => buyer.email,
          "status" => "active"
        )
        expect(props["pagination"]).to include("page" => 1, "count" => 1)
      end

      it "filters subscriptions by status" do
        cancelled_sub = create(:subscription, link: product, user: buyer, seller:, cancelled_at: Time.current)

        get admin_subscriptions_path, params: { status: "cancelled" }, headers: { "X-Inertia" => "true" }

        expect(response).to have_http_status(:ok)
        props = JSON.parse(response.body)["props"]
        sub_ids = props["subscriptions"].map { _1["id"] }

        expect(sub_ids).to include(cancelled_sub.external_id)
        expect(sub_ids).not_to include(subscription.external_id)
      end

      it "searches subscriptions by subscriber query" do
        get admin_subscriptions_path, params: { q: "subscriber@example.com" }, headers: { "X-Inertia" => "true" }

        expect(response).to have_http_status(:ok)
        props = JSON.parse(response.body)["props"]

        expect(props["subscriptions"].first["id"]).to eq(subscription.external_id)
      end
    end
  end

  describe "GET /admin/subscriptions/:id" do
    context "when visitor is signed in as an authorized admin team member" do
      before { sign_in admin }

      it "renders the show page with full subscription details" do
        get admin_subscription_path(subscription.external_id), headers: { "X-Inertia" => "true" }

        expect(response).to have_http_status(:ok)
        props = JSON.parse(response.body)["props"]

        expect(props["subscription"]).to include(
          "id" => subscription.external_id,
          "status" => "active",
          "frequency" => "monthly"
        )
        expect(props["subscription"]["subscriber"]["email"]).to eq(buyer.email)
        expect(props["subscription"]["product"]["name"]).to eq("Pro Plan")
        expect(props["subscription"]["charges"]).to be_an(Array)
      end

      it "redirects when subscription is not found" do
        get admin_subscription_path("non_existent_id")

        expect(response).to redirect_to(admin_subscriptions_path)
        expect(flash[:alert]).to eq("Subscription not found")
      end
    end
  end

  describe "POST /admin/subscriptions/:id/cancel" do
    context "when visitor is signed in as an authorized admin team member" do
      before { sign_in admin }

      it "cancels an active subscription" do
        post cancel_admin_subscription_path(subscription.external_id)

        expect(response).to redirect_to(admin_subscription_path(subscription.external_id))
        expect(flash[:notice]).to eq("Successfully cancelled subscription")
        expect(subscription.reload.cancelled_at).to be_present
      end

      it "rejects cancellation if already cancelled" do
        subscription.update!(cancelled_at: Time.current)

        post cancel_admin_subscription_path(subscription.external_id)

        expect(response).to redirect_to(admin_subscription_path(subscription.external_id))
        expect(flash[:alert]).to include("already cancelled")
      end
    end
  end
end
