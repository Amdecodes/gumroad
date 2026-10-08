# frozen_string_literal: true

require "spec_helper"

describe "Admin::Marketing", type: :request, inertia: true do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:admin_user, name: "Admin Lead", email: "admin@gumroad.com") }
  let(:regular_user) { create(:user) }
  let(:seller) { create(:user, name: "Marketing Creator") }
  let(:affiliate_user) { create(:user, name: "Affiliate Partner", email: "affiliate@example.com") }
  let(:product) { create(:product, user: seller, name: "Course Pro", price_cents: 5000) }

  let!(:offer_code) do
    create(
      :percentage_offer_code,
      user: seller,
      products: [product],
      code: "LAUNCH2026",
      amount_percentage: 20
    )
  end

  let!(:affiliate) do
    create(
      :direct_affiliate,
      seller:,
      affiliate_user:,
      affiliate_basis_points: 2000
    )
  end

  let!(:audience_member) do
    create(
      :audience_member,
      seller:,
      email: "fan@example.com"
    )
  end

  before do
    host! DOMAIN
    stub_const("GUMROAD_ADMIN_ID", admin.id)
  end

  describe "GET /admin/marketing" do
    context "when visitor is not signed in" do
      it "redirects to the login page" do
        get admin_marketing_path

        expect(response).to redirect_to(login_path(next: admin_marketing_path))
      end
    end

    context "when visitor is signed in as a regular user" do
      before { sign_in regular_user }

      it "redirects to root" do
        get admin_marketing_path

        expect(response).to redirect_to(root_path)
      end
    end

    context "when visitor is signed in as an authorized admin team member" do
      before { sign_in admin }

      it "renders the marketing overview with coupons, affiliates, audience and metrics" do
        get admin_marketing_path, headers: { "X-Inertia" => "true" }

        expect(response).to have_http_status(:ok)
        props = JSON.parse(response.body)["props"]

        expect(props["metrics"]["total_offers_count"]).to be >= 1
        expect(props["metrics"]["total_affiliates_count"]).to be >= 1
        expect(props["metrics"]["total_audience_count"]).to be >= 1

        expect(props["offers"]).to be_an(Array)
        expect(props["offers"].first).to include(
          "code" => "LAUNCH2026",
          "discount_formatted" => "20%"
        )

        expect(props["affiliates"]).to be_an(Array)
        expect(props["affiliates"]).to include(
          a_hash_including(
            "email" => affiliate_user.email,
            "fee_percentage" => 20.0
          )
        )

        expect(props["audience_samples"]).to be_an(Array)
        expect(props["audience_samples"].first).to include(
          "email" => "fan@example.com"
        )
      end
    end
  end
end
