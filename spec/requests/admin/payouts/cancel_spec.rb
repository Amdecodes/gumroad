# frozen_string_literal: true

require "spec_helper"

describe "Admin::Payouts POST /admin/payouts/:id/cancel", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:admin_user, name: "Admin Risk Lead") }
  let(:regular_user) { create(:user) }
  let(:seller) { create(:compliant_user, name: "Creator Cancel", username: "creatorcancel", email: "cancel@example.com") }

  let(:scheduled_payout) do
    create(
      :scheduled_payout,
      user: seller,
      payout_amount_cents: 35_000,
      status: "pending",
      delay_days: 14
    )
  end

  let(:completed_payment) do
    create(
      :payment_completed,
      user: seller,
      amount_cents: 50_000
    )
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

  context "when visitor is not signed in" do
    it "redirects to the login page without minting tokens or creating audit logs" do
      initial_tokens_count = AdminApiToken.count
      initial_audit_count = AdminApiAuditLog.count

      post cancel_admin_payout_path(scheduled_payout.external_id), params: { reason: "Suspicious chargeback spikes" }

      expect(response).to redirect_to(login_path(next: cancel_admin_payout_path(scheduled_payout.external_id)))
      expect(AdminApiToken.count).to eq(initial_tokens_count)
      expect(AdminApiAuditLog.count).to eq(initial_audit_count)
    end
  end

  context "when visitor is signed in as a regular user" do
    before { sign_in regular_user }

    it "refuses access and redirects to root" do
      initial_tokens_count = AdminApiToken.count
      initial_audit_count = AdminApiAuditLog.count

      post cancel_admin_payout_path(scheduled_payout.external_id), params: { reason: "Suspicious chargeback spikes" }

      expect(response).to redirect_to(root_path)
      expect(AdminApiToken.count).to eq(initial_tokens_count)
      expect(AdminApiAuditLog.count).to eq(initial_audit_count)
    end
  end

  context "when signed in as an authorized admin team member" do
    before { sign_in admin }

    it "validates that reason is required" do
      initial_tokens_count = AdminApiToken.count
      initial_audit_count = AdminApiAuditLog.count

      post cancel_admin_payout_path(scheduled_payout.external_id), params: { reason: "   " }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body["message"]).to eq("Reason is required to cancel a payout.")
      expect(AdminApiToken.count).to eq(initial_tokens_count)
      expect(AdminApiAuditLog.count).to eq(initial_audit_count)
    end

    it "refuses cancellation on an executed payment transfer" do
      post cancel_admin_payout_path(completed_payment.external_id), params: { reason: "Some reason" }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body["message"]).to eq("Cannot cancel an executed payment transfer.")
    end

    it "performs cancellation in-process, creates exactly 1 audit log row, and revokes the token" do
      initial_tokens_count = AdminApiToken.count
      initial_audit_count = AdminApiAuditLog.count

      post cancel_admin_payout_path(scheduled_payout.external_id),
           params: { reason: "Disputed transactions under investigation" },
           as: :json

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["success"]).to be(true)

      # Token lifecycle: minted and revoked
      expect(AdminApiToken.count).to eq(initial_tokens_count + 1)
      latest_token = AdminApiToken.last
      expect(latest_token.actor_user_id).to eq(admin.id)
      expect(latest_token.active?).to be(false)

      # Audit log: exactly one row created
      expect(AdminApiAuditLog.count).to eq(initial_audit_count + 1)
      latest_log = AdminApiAuditLog.last
      expect(latest_log.action).to eq("scheduled_payouts.cancel")
      expect(latest_log.actor_user_id).to eq(admin.id)
      expect(latest_log.target_type).to eq("ScheduledPayout")
      expect(latest_log.target_id).to eq(scheduled_payout.id)
      expect(latest_log.response_status).to eq(200)

      # ScheduledPayout status updated
      expect(scheduled_payout.reload.status).to eq("cancelled")

      # Creator payout note comment recorded
      expect(seller.comments.with_type_payout_note.last.content).to include("Disputed transactions under investigation")
    end

    it "propagates internal API errors verbatim" do
      allow_any_instance_of(ScheduledPayout).to receive(:cancel!).and_raise("Cannot cancel an already executed payout")

      post cancel_admin_payout_path(scheduled_payout.external_id),
           params: { reason: "Risk reason" },
           as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body["success"]).to be(false)
      expect(response.parsed_body["message"]).to eq("Cannot cancel an already executed payout")
    end
  end
end
