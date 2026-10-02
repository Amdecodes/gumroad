# frozen_string_literal: true

require "spec_helper"

describe "Admin::TeamMembers GET /admin/team/:id", type: :request, inertia: true do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:admin_user, name: "Admin Lead", email: "lead@gumroad.com") }
  let(:regular_user) { create(:user) }

  before do
    host! DOMAIN
  end

  context "when visitor is not signed in" do
    it "redirects to the login page" do
      get admin_team_member_path("nonexistent")

      expect(response).to redirect_to(login_path(next: admin_team_member_path("nonexistent")))
    end
  end

  context "when visitor is signed in as a regular user" do
    before { sign_in regular_user }

    it "redirects to root" do
      get admin_team_member_path("nonexistent")

      expect(response).to redirect_to(root_path)
    end
  end

  context "when visitor is signed in as an authorized admin team member" do
    before { sign_in admin }

    let(:staff_member) do
      create(:user,
             is_team_member: true,
             name: "Alice Engineer",
             username: "aliceeng",
             email: "alice@gumroad.com",
             bio: "Senior Infrastructure Engineer"
      )
    end

    let!(:log_entry) do
      create(:admin_api_audit_log,
             actor_user: staff_member,
             action: "users.mark_compliant",
             route: "/internal/admin/users/mark_compliant",
             response_status: 200,
             target_type: "User",
             target_external_id: "usr_999"
      )
    end

    it "returns 404 for regular user who is not a team member" do
      get admin_team_member_path(regular_user.external_id)

      expect(response).to have_http_status(:not_found)
    end

    it "renders the Team Member Show page with profile, stats, and audit history" do
      get admin_team_member_path(staff_member.external_id), headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["component"]).to eq("Admin/Team/Show")

      props = body["props"]
      expect(props["member"]["email"]).to eq(staff_member.email)
      expect(props["member"]["name"]).to eq("Alice Engineer")
      expect(props["member"]["can_revoke"]).to eq(true)
      expect(props["stats"]["actions_count"]).to eq(1)

      recent_actions = props["recent_actions"]
      expect(recent_actions.size).to eq(1)
      expect(recent_actions.first["action"]).to eq("users.mark_compliant")
    end
  end
end
