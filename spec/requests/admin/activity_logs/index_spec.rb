# frozen_string_literal: true

require "spec_helper"

describe "Admin::ActivityLogs GET /admin/activity-log", type: :request, inertia: true do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:admin_user, name: "Admin Lead", email: "lead@gumroad.com") }
  let(:regular_user) { create(:user) }

  before do
    host! DOMAIN
  end

  context "when visitor is not signed in" do
    it "redirects to the login page" do
      get admin_activity_logs_path

      expect(response).to redirect_to(login_path(next: admin_activity_logs_path))
    end
  end

  context "when visitor is signed in as a regular user" do
    before { sign_in regular_user }

    it "redirects to root" do
      get admin_activity_logs_path

      expect(response).to redirect_to(root_path)
    end
  end

  context "when visitor is signed in as an authorized admin team member" do
    before { sign_in admin }

    let(:other_admin) { create(:admin_user, name: "Staff Member", email: "staff@gumroad.com") }

    let!(:log1) do
      create(:admin_api_audit_log,
             actor_user: admin,
             action: "users.suspend_for_fraud",
             route: "/internal/admin/users/suspend_for_fraud",
             response_status: 200,
             target_type: "User",
             target_external_id: "usr_123",
             created_at: 2.hours.ago
      )
    end

    let!(:log2) do
      create(:admin_api_audit_log,
             actor_user: other_admin,
             action: "purchases.refund",
             route: "/internal/admin/purchases/ord_456/refund",
             response_status: 422,
             error_class: "RefundFailedError",
             target_type: "Purchase",
             target_external_id: "ord_456",
             created_at: 1.hour.ago
      )
    end

    it "renders the Activity Log Index page with serialized audit entries" do
      get admin_activity_logs_path, headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["component"]).to eq("Admin/ActivityLog/Index")

      props = body["props"]
      expect(props).to have_key("logs")
      expect(props).to have_key("pagy")
      expect(props).to have_key("available_actions")
      expect(props).to have_key("available_actors")
      expect(props).to have_key("filters")

      actions = props["logs"].map { |l| l["action"] }
      expect(actions).to include("users.suspend_for_fraud", "purchases.refund")
    end

    it "filters logs by action name" do
      get admin_activity_logs_path, params: { action_name: "users.suspend_for_fraud" }, headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      logs = body.dig("props", "logs")
      expect(logs.size).to eq(1)
      expect(logs.first["action"]).to eq("users.suspend_for_fraud")
    end

    it "filters logs by actor external ID" do
      get admin_activity_logs_path, params: { actor: other_admin.external_id }, headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      logs = body.dig("props", "logs")
      expect(logs.size).to eq(1)
      expect(logs.first["actor"]["email"]).to eq(other_admin.email)
    end

    it "filters logs by status failure" do
      get admin_activity_logs_path, params: { status: "failure" }, headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      logs = body.dig("props", "logs")
      expect(logs.size).to eq(1)
      expect(logs.first["status"]).to eq("failure")
      expect(logs.first["response_status"]).to eq(422)
    end

    it "filters logs by search query" do
      get admin_activity_logs_path, params: { q: "ord_456" }, headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      logs = body.dig("props", "logs")
      expect(logs.size).to eq(1)
      expect(logs.first["target_external_id"]).to eq("ord_456")
    end
  end
end
