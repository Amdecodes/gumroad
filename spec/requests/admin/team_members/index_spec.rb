# frozen_string_literal: true

require "spec_helper"

describe "Admin::TeamMembers GET /admin/team", type: :request, inertia: true do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:admin_user, name: "Admin Lead", email: "lead@gumroad.com") }
  let(:regular_user) { create(:user, name: "Regular Guy", email: "regular@example.com") }

  before do
    host! DOMAIN
  end

  context "when visitor is not signed in" do
    it "redirects to the login page" do
      get admin_team_members_path

      expect(response).to redirect_to(login_path(next: admin_team_members_path))
    end
  end

  context "when visitor is signed in as a regular user" do
    before { sign_in regular_user }

    it "redirects to root" do
      get admin_team_members_path

      expect(response).to redirect_to(root_path)
    end
  end

  context "when visitor is signed in as an authorized admin team member" do
    before { sign_in admin }

    let!(:root_admin) { create(:user, is_team_member: true, email: ApplicationMailer::ADMIN_EMAIL, name: "Root Admin") }
    let!(:other_staff) { create(:user, is_team_member: true, name: "Staff Bob", username: "staffbob", email: "bob@gumroad.com") }

    it "renders the Team Index page with team members only" do
      get admin_team_members_path, headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["component"]).to eq("Admin/Team/Index")

      props = body["props"]
      expect(props).to have_key("team_members")
      expect(props).to have_key("pagy")
      expect(props).to have_key("filters")

      emails = props["team_members"].map { |m| m["email"] }
      expect(emails).to include(admin.email, root_admin.email, other_staff.email)
      expect(emails).not_to include(regular_user.email)
    end

    it "correctly computes can_revoke permissions" do
      get admin_team_members_path, headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      members = body.dig("props", "team_members").index_by { |m| m["email"] }

      expect(members[admin.email]["can_revoke"]).to eq(false) # Current user
      expect(members[root_admin.email]["can_revoke"]).to eq(false) # Platform owner
      expect(members[other_staff.email]["can_revoke"]).to eq(true) # Other staff
    end

    it "filters staff by search query" do
      get admin_team_members_path, params: { q: "staffbob" }, headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      members = body.dig("props", "team_members")
      expect(members.size).to eq(1)
      expect(members.first["email"]).to eq(other_staff.email)
    end
  end
end
