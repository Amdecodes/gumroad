# frozen_string_literal: true

require "spec_helper"

describe "Admin::Creators POST /admin/creators/:id/unsuspend", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:admin_user, name: "Admin Lead") }
  let(:regular_user) { create(:user) }
  let(:creator) { create(:user, name: "Suspended Creator", username: "unsuspme", email: "unsusp@example.com", user_risk_state: "suspended_for_tos_violation") }

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
    it "redirects to the login page without minting tokens or creating audit logs" do
      initial_tokens_count = AdminApiToken.count
      initial_audit_count = AdminApiAuditLog.count

      post unsuspend_admin_creator_path(creator.external_id), params: { reason: "Appeal granted" }

      expect(response).to redirect_to(login_path(next: unsuspend_admin_creator_path(creator.external_id)))
      expect(AdminApiToken.count).to eq(initial_tokens_count)
      expect(AdminApiAuditLog.count).to eq(initial_audit_count)
    end
  end

  context "when visitor is signed in as a regular user" do
    before { sign_in regular_user }

    it "refuses access and redirects to root" do
      initial_tokens_count = AdminApiToken.count
      initial_audit_count = AdminApiAuditLog.count

      post unsuspend_admin_creator_path(creator.external_id), params: { reason: "Appeal granted" }

      expect(response).to redirect_to(root_path)
      expect(AdminApiToken.count).to eq(initial_tokens_count)
      expect(AdminApiAuditLog.count).to eq(initial_audit_count)
    end
  end

  context "when signed in as an authorized admin team member" do
    before { sign_in admin }

    it "validates that reason is required before minting tokens" do
      initial_tokens_count = AdminApiToken.count
      initial_audit_count = AdminApiAuditLog.count

      post unsuspend_admin_creator_path(creator.external_id), params: { reason: "   " }

      expect(response).to redirect_to(admin_creator_path(creator.external_id))
      expect(flash[:alert]).to include("Reason is required")
      expect(AdminApiToken.count).to eq(initial_tokens_count)
      expect(AdminApiAuditLog.count).to eq(initial_audit_count)
    end

    it "returns 400 for blank reason on json request" do
      post unsuspend_admin_creator_path(creator.external_id), params: { reason: "" }, as: :json

      expect(response).to have_http_status(:bad_request)
      body = JSON.parse(response.body)
      expect(body["success"]).to be(false)
      expect(body["message"]).to include("Reason is required")
    end

    it "performs unsuspension in-process, creates exactly 1 audit log row, and revokes the token" do
      initial_tokens_count = AdminApiToken.count
      initial_audit_count = AdminApiAuditLog.count

      post unsuspend_admin_creator_path(creator.external_id), params: { reason: "Review cleared after verification" }

      expect(response).to redirect_to(admin_creator_path(creator.external_id))
      follow_redirect!
      expect(response).to have_http_status(:ok)
      expect(creator.reload).to be_compliant

      # 1. Exactly one audit log row created
      expect(AdminApiAuditLog.count).to eq(initial_audit_count + 1)
      latest_log = AdminApiAuditLog.last
      expect(latest_log).to have_attributes(
        action: "users.mark_compliant",
        actor_user_id: admin.id,
        target_type: "User",
        target_id: creator.id,
        target_external_id: creator.external_id,
        response_status: 200
      )

      # 2. Token was minted and revoked
      expect(AdminApiToken.count).to eq(initial_tokens_count + 1)
      latest_token = AdminApiToken.last
      expect(latest_token.actor_user_id).to eq(admin.id)
      expect(latest_token.active?).to be(false)

      # 3. Outer request session remains logged in as admin
      get admin_root_path
      expect(response).to have_http_status(:ok)
      expect(controller.current_user).to eq(admin)
    end

    it "passes API validation / already compliant messages through verbatim" do
      creator.update!(user_risk_state: "compliant")

      post unsuspend_admin_creator_path(creator.external_id), params: { reason: "Already compliant" }

      expect(response).to redirect_to(admin_creator_path(creator.external_id))
      expect(flash[:notice]).to eq("User is already compliant")
    end
  end
end
