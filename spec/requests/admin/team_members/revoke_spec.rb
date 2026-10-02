# frozen_string_literal: true

require "spec_helper"

describe "Admin::TeamMembers POST /admin/team/:id/revoke", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:admin_user, name: "Admin Lead", email: "lead@gumroad.com") }
  let(:regular_user) { create(:user) }

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

  context "when visitor is not signed in" do
    it "redirects to the login page" do
      post revoke_admin_team_member_path("any_id")

      expect(response).to redirect_to(login_path(next: revoke_admin_team_member_path("any_id")))
    end
  end

  context "when visitor is signed in as a regular user" do
    before { sign_in regular_user }

    it "redirects to root" do
      post revoke_admin_team_member_path("any_id")

      expect(response).to redirect_to(root_path)
    end
  end

  context "when visitor is signed in as an authorized admin team member" do
    before { sign_in admin }

    let(:root_account) { create(:user, is_team_member: true, email: ApplicationMailer::ADMIN_EMAIL, name: "Root Admin") }
    let(:staff_user) { create(:user, is_team_member: true, name: "Junior Admin", email: "junior@gumroad.com") }

    it "returns 404 when target is not a staff member" do
      post revoke_admin_team_member_path(regular_user.external_id)

      expect(response).to have_http_status(:not_found)
    end

    it "prevents self-revocation with 422 status" do
      post revoke_admin_team_member_path(admin.external_id), as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body["message"]).to match(/cannot revoke your own/i)
      expect(admin.reload.is_team_member).to eq(true)
    end

    it "prevents revoking the platform root account with 422 status" do
      post revoke_admin_team_member_path(root_account.external_id), as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body["message"]).to match(/root account cannot be revoked/i)
      expect(root_account.reload.is_team_member).to eq(true)
    end

    it "successfully revokes staff member access through Admin::InternalApiCaller with an audit log" do
      initial_audit_count = AdminApiAuditLog.count

      # Add team membership with root seller to verify cascade deletion
      membership = create(:team_membership, seller: root_account, user: staff_user, role: TeamMembership::ROLE_ADMIN)

      post revoke_admin_team_member_path(staff_user.external_id),
           params: { reason: "Departed engineering team" }

      expect(response).to redirect_to(admin_team_members_path)
      follow_redirect!
      expect(response.body).to include("Staff access for Junior Admin was revoked successfully.")

      # Verify flag cleared
      expect(staff_user.reload.is_team_member).to eq(false)
      expect(membership.reload.deleted?).to eq(true)

      # Verify exactly 1 audit log created by InternalApiCaller
      expect(AdminApiAuditLog.count).to eq(initial_audit_count + 1)
      latest_log = AdminApiAuditLog.last
      expect(latest_log.actor_user_id).to eq(admin.id)
      expect(latest_log.action).to eq("users.create_comment")
      expect(latest_log.target_type).to eq("User")
      expect(latest_log.target_id).to eq(staff_user.id)
    end
  end
end
