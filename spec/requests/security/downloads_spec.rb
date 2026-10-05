# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Security: Digital Downloads & Fulfillment Verification", type: :request do
  let(:seller) { create(:user) }
  let(:buyer) { create(:user) }
  let(:product) { create(:product, user: seller, price_cents: 50000, price_currency_type: "etb") }
  let(:product_file) { create(:product_file, link: product) }

  before do
    host! DOMAIN
  end

  describe "GET /r/:token/product_files" do
    context "when purchase is successful" do
      let(:purchase) do
        create(:purchase,
               link: product,
               purchaser: buyer,
               email: buyer.email,
               price_cents: 50000,
               purchase_state: "successful",
               ip_address: "127.0.0.1",
               charge_processor_id: "chapa")
      end
      let(:url_redirect) { create(:url_redirect, purchase:, link: product) }

      it "allows authenticated expiring download redirecting to a signed URL with 30-minute TTL" do
        allow_any_instance_of(UrlRedirect).to receive(:signed_location_for_file).with(product_file)
          .and_return("https://storage.arifdrop.com/attachments/test-file.pdf?X-Amz-Expires=1800&X-Amz-Signature=abc")

        get url_redirect_download_product_files_path(url_redirect.token, product_file_ids: [product_file.external_id])

        expect(response).to have_http_status(:redirect)
        expect(response.location).to include("X-Amz-Expires=1800")
        expect(SignedUrlHelper::SIGNED_S3_URL_VALID_FOR_MINIMUM).to eq(30.minutes)
      end
    end

    context "when purchase is pending" do
      let(:pending_purchase) do
        create(:purchase,
               link: product,
               purchaser: buyer,
               email: buyer.email,
               price_cents: 50000,
               purchase_state: "in_progress",
               charge_processor_id: "chapa")
      end
      let(:pending_redirect) { create(:url_redirect, purchase: pending_purchase, link: product) }

      it "rejects download attempt with 403 Forbidden" do
        cookies[:_gumroad_guid] = pending_purchase.browser_guid

        get url_redirect_download_product_files_path(pending_redirect.token, product_file_ids: [product_file.external_id])

        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when purchase is failed" do
      let(:failed_purchase) do
        create(:purchase,
               link: product,
               purchaser: buyer,
               email: buyer.email,
               price_cents: 50000,
               purchase_state: "failed",
               charge_processor_id: "chapa")
      end
      let(:failed_redirect) { create(:url_redirect, purchase: failed_purchase, link: product) }

      it "rejects download attempt with 403 Forbidden" do
        cookies[:_gumroad_guid] = failed_purchase.browser_guid

        get url_redirect_download_product_files_path(failed_redirect.token, product_file_ids: [product_file.external_id])

        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when purchase is refunded" do
      let(:refunded_purchase) do
        create(:purchase,
               link: product,
               purchaser: buyer,
               email: buyer.email,
               price_cents: 50000,
               purchase_state: "successful",
               stripe_refunded: true,
               charge_processor_id: "chapa")
      end
      let(:refunded_redirect) { create(:url_redirect, purchase: refunded_purchase, link: product) }

      it "rejects download attempt with 403 Forbidden" do
        cookies[:_gumroad_guid] = refunded_purchase.browser_guid

        get url_redirect_download_product_files_path(refunded_redirect.token, product_file_ids: [product_file.external_id])

        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when accessing invalid or tampered token" do
      it "returns 404 Not Found" do
        get url_redirect_download_product_files_path("tampered_non_existent_token", product_file_ids: [product_file.external_id])

        expect(response).to have_http_status(:not_found)
      end
    end
  end
end
