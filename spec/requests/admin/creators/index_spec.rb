# frozen_string_literal: true

require "spec_helper"

describe "Admin::Creators GET /admin/creators", type: :request, inertia: true do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:admin_user, name: "Admin Lead") }
  let(:regular_user) { create(:user) }

  before do
    host! DOMAIN
  end

  context "when visitor is not signed in" do
    it "redirects to the login page" do
      get admin_creators_path

      expect(response).to redirect_to(login_path(next: admin_creators_path))
    end
  end

  context "when visitor is signed in as a regular user" do
    before { sign_in regular_user }

    it "redirects to root" do
      get admin_creators_path

      expect(response).to redirect_to(root_path)
    end
  end

  context "when visitor is signed in as an authorized admin team member" do
    before { sign_in admin }

    let!(:active_creator) { create(:user, name: "Alice Wonderland", username: "alice", email: "alice@example.com") }
    let!(:suspended_creator) do
      create(:user, name: "Bob Suspended", username: "bobsusp", email: "bob@example.com", user_risk_state: "suspended_for_tos_violation")
    end
    let!(:deleted_creator) do
      u = create(:user, name: "Charlie Deleted", username: "charlie", email: "charlie@example.com")
      u.mark_deleted!
      u
    end

    it "renders the Creators Index page with serialized creators and pagy metadata" do
      get admin_creators_path, headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["component"]).to eq("Admin/Creators/Index")

      props = body["props"]
      expect(props).to have_key("creators")
      expect(props).to have_key("pagy")
      expect(props).to have_key("filters")
      expect(props).to have_key("current_admin")

      emails = props["creators"].map { |c| c["email"] }
      expect(emails).to include("alice@example.com", "bob@example.com")
      expect(emails).not_to include("charlie@example.com") # deleted excluded by default
    end

    it "filters creators by email search" do
      get admin_creators_path(q: "alice@example.com"), headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      props = JSON.parse(response.body)["props"]
      emails = props["creators"].map { |c| c["email"] }
      expect(emails).to include("alice@example.com")
      expect(emails).not_to include("bob@example.com")
      expect(props["filters"]["q"]).to eq("alice@example.com")
    end

    it "filters creators by username search with @" do
      get admin_creators_path(q: "@alice"), headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      props = JSON.parse(response.body)["props"]
      usernames = props["creators"].map { |c| c["username"] }
      expect(usernames).to include("alice")
      expect(usernames).not_to include("bobsusp")
    end

    it "filters creators by name search" do
      get admin_creators_path(q: "Wonderland"), headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      props = JSON.parse(response.body)["props"]
      emails = props["creators"].map { |c| c["email"] }
      expect(emails).to include("alice@example.com")
      expect(emails).not_to include("bob@example.com")
    end

    it "filters creators by status=suspended" do
      get admin_creators_path(status: "suspended"), headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      props = JSON.parse(response.body)["props"]
      emails = props["creators"].map { |c| c["email"] }
      expect(emails).to include("bob@example.com")
      expect(emails).not_to include("alice@example.com")
      expect(props["filters"]["status"]).to eq("suspended")
    end

    it "filters creators by status=active" do
      get admin_creators_path(status: "active"), headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      props = JSON.parse(response.body)["props"]
      emails = props["creators"].map { |c| c["email"] }
      expect(emails).to include("alice@example.com")
      expect(emails).not_to include("bob@example.com")
    end

    it "filters creators by status=deleted" do
      get admin_creators_path(status: "deleted"), headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      props = JSON.parse(response.body)["props"]
      emails = props["creators"].map { |c| c["email"] }
      expect(emails).to include("charlie@example.com")
      expect(emails).not_to include("alice@example.com")
    end
  end
end
