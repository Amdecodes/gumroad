# frozen_string_literal: true

require "spec_helper"

describe "Admin::Products Actions POST /admin/products/:id/unpublish and /publish", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:admin_user, name: "Admin Lead", email: "lead@gumroad.com") }
  let(:regular_user) { create(:user) }
  let(:seller) { create(:user, name: "Seller User", email: "seller@example.com") }
  let(:product) { create(:product, user: seller, name: "Live Course", draft: false) }

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

  describe "POST /admin/products/:id/unpublish" do
    context "when visitor is not signed in" do
      it "redirects to the login page" do
        post unpublish_admin_product_path(product.unique_permalink)

        expect(response).to redirect_to(login_path(next: unpublish_admin_product_path(product.unique_permalink)))
      end
    end

    context "when visitor is signed in as a regular user" do
      before { sign_in regular_user }

      it "redirects to root" do
        post unpublish_admin_product_path(product.unique_permalink)

        expect(response).to redirect_to(root_path)
      end
    end

    context "when visitor is signed in as an authorized admin team member" do
      before { sign_in admin }

      it "rejects blank moderation reason" do
        post unpublish_admin_product_path(product.unique_permalink), params: { reason: "" }, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.parsed_body["message"]).to match(/reason is required/i)
      end

      it "unpublishes product and records audit log" do
        initial_log_count = AdminApiAuditLog.count

        post unpublish_admin_product_path(product.unique_permalink), params: { reason: "Copyright infringement complaint" }, as: :json

        expect(response).to have_http_status(:ok)
        expect(response.parsed_body["success"]).to eq(true)
        expect(product.reload.purchase_disabled_at).to be_present

        expect(AdminApiAuditLog.count).to eq(initial_log_count + 1)
        latest_log = AdminApiAuditLog.last
        expect(latest_log.actor_user_id).to eq(admin.id)
        expect(latest_log.target_type).to eq("Link")
        expect(latest_log.target_id).to eq(product.id)
        expect(latest_log.action).to eq("products.unpublish")
      end
    end
  end

  describe "POST /admin/products/:id/publish" do
    before { sign_in admin }

    let(:unpublished_product) do
      p = create(:product, user: seller, name: "Pending Course", draft: false)
      p.unpublish!(is_unpublished_by_admin: true)
      p
    end

    it "rejects blank moderation reason" do
      post publish_admin_product_path(unpublished_product.unique_permalink), params: { reason: "" }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body["message"]).to match(/reason is required/i)
    end

    it "publishes product and records audit log" do
      initial_log_count = AdminApiAuditLog.count

      post publish_admin_product_path(unpublished_product.unique_permalink), params: { reason: "Copyright cleared with valid license" }, as: :json

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["success"]).to eq(true)
      expect(unpublished_product.reload.published?).to eq(true)

      expect(AdminApiAuditLog.count).to eq(initial_log_count + 1)
      latest_log = AdminApiAuditLog.last
      expect(latest_log.actor_user_id).to eq(admin.id)
      expect(latest_log.target_type).to eq("Link")
      expect(latest_log.target_id).to eq(unpublished_product.id)
      expect(latest_log.action).to eq("products.publish")
    end
  end
end
