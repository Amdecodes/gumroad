# frozen_string_literal: true

require "spec_helper"

describe "Admin::ActivityLogs GET /admin/activity-log/:id", type: :request, inertia: true do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:admin_user, name: "Admin Lead", email: "lead@gumroad.com") }
  let(:regular_user) { create(:user) }

  before do
    host! DOMAIN
  end

  context "when visitor is not signed in" do
    it "redirects to the login page" do
      get admin_activity_log_path(999_999)

      expect(response).to redirect_to(login_path(next: admin_activity_log_path(999_999)))
    end
  end

  context "when visitor is signed in as a regular user" do
    before { sign_in regular_user }

    it "redirects to root" do
      get admin_activity_log_path(999_999)

      expect(response).to redirect_to(root_path)
    end
  end

  context "when visitor is signed in as an authorized admin team member" do
    before { sign_in admin }

    let!(:log_entry) do
      create(:admin_api_audit_log,
             actor_user: admin,
             action: "users.suspend_for_tos_violation",
             route: "/internal/admin/users/suspend_for_tos_violation",
             http_method: "POST",
             response_status: 200,
             target_type: "User",
             target_external_id: "usr_target_99",
             params_snapshot: { "user_id" => "usr_target_99", "suspension_note" => "Policy violation" }
      )
    end

    it "returns 404 when log id is not found" do
      get admin_activity_log_path(999_999)

      expect(response).to have_http_status(:not_found)
    end

    it "renders the Show page with full audit details and params snapshot" do
      get admin_activity_log_path(log_entry.id), headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["component"]).to eq("Admin/ActivityLog/Show")

      log_props = body.dig("props", "log")
      expect(log_props["id"]).to eq(log_entry.id.to_s)
      expect(log_props["action"]).to eq("users.suspend_for_tos_violation")
      expect(log_props["target_type"]).to eq("User")
      expect(log_props["target_external_id"]).to eq("usr_target_99")
      expect(log_props["params_snapshot"]).to eq({ "user_id" => "usr_target_99", "suspension_note" => "Policy violation" })
    end

    it "returns json when requested with json format" do
      get admin_activity_log_path(log_entry.id), headers: { "Accept" => "application/json" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["success"]).to eq(true)
      expect(body["log"]["id"]).to eq(log_entry.id.to_s)
    end
  end
end
