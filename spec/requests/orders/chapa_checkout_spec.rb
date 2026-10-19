# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Chapa Checkout & Lifecycle", type: :request do
  let(:seller) { create(:user) }
  let(:product) { create(:product, user: seller, price_cents: 25000, price_currency_type: "etb") }
  let(:guid) { SecureRandom.hex(16) }
  let(:headers) do
    {
      "HOST" => VALID_REQUEST_HOSTS.first,
      "X-Inertia" => "true"
    }
  end

  before do
    host! VALID_REQUEST_HOSTS.first
    cookies[:_gumroad_guid] = guid
  end

  describe "POST /orders" do
    it "initializes Chapa transaction for an ETB order and returns checkout URL" do
      allow_any_instance_of(Chapa::Client).to receive(:initialize_transaction) do |_client, args|
        expect(args[:purchase].price_in_currency_cents).to eq(25000)
        expect(args[:return_url]).to include("/orders/")
        expect(args[:callback_url]).to include("/webhooks/chapa")

        {
          success: true,
          tx_ref: args[:tx_ref],
          checkout_url: "https://checkout.chapa.co/checkout/payment/CHAPA_PAY_URL_99"
        }
      end

      post "/orders", params: {
        email: "buyer@example.com",
        full_name: "Tadesse Mesfin",
        line_items: [
          {
            permalink: product.unique_permalink,
            perceived_price_cents: "25000",
            quantity: "1",
            uid: "uid_line_1"
          }
        ]
      }, headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["success"]).to be true
      expect(body["checkout_url"]).to eq("https://checkout.chapa.co/checkout/payment/CHAPA_PAY_URL_99")
      expect(body["tx_ref"]).to be_present

      tx = ChapaTransaction.find_by(tx_ref: body["tx_ref"])
      expect(tx).to be_present
      expect(tx.status).to eq("pending")
      expect(tx.amount_santims).to eq(25000)
      expect(tx.currency).to eq("ETB")
    end

    it "returns unprocessable entity when Chapa initialization fails" do
      allow_any_instance_of(Chapa::Client).to receive(:initialize_transaction)
        .and_return({
                      success: false,
                      error: "Chapa service unavailable"
                    })

      post "/orders", params: {
        email: "buyer@example.com",
        full_name: "Tadesse Mesfin",
        line_items: [
          {
            permalink: product.unique_permalink,
            perceived_price_cents: "25000",
            quantity: "1",
            uid: "uid_line_1"
          }
        ]
      }, headers: headers

      expect(response).to have_http_status(:unprocessable_content)
      body = JSON.parse(response.body)
      expect(body["success"]).to be false
      expect(body["error_message"]).to eq("Chapa service unavailable")
    end

    it "rejects recurring products in English when recurring_products feature flag is off" do
      allow(Feature).to receive(:active?).and_call_original
      allow(Feature).to receive(:active?).with(:recurring_products, any_args).and_return(true)
      membership = create(:membership_product, user: seller, price_cents: 100_00, price_currency_type: "etb")
      allow(Feature).to receive(:active?).with(:recurring_products, any_args).and_return(false)

      post "/orders", params: {
        email: "buyer@example.com",
        full_name: "Tadesse Mesfin",
        line_items: [
          {
            permalink: membership.unique_permalink,
            perceived_price_cents: "10000",
            quantity: "1",
            uid: "uid_line_recurring"
          }
        ]
      }, headers: headers

      expect(response).to have_http_status(:unprocessable_content)
      body = JSON.parse(response.body)
      expect(body["success"]).to be false
      expect(body["error_message"]).to eq("Subscriptions, installments, and preorders are currently unavailable with Chapa. Only one-time purchases in ETB are supported.")
    end

    it "returns localized 422 error message in Amharic when locale is am" do
      allow(Feature).to receive(:active?).and_call_original
      allow(Feature).to receive(:active?).with(:recurring_products, any_args).and_return(true)
      membership = create(:membership_product, user: seller, price_cents: 100_00, price_currency_type: "etb")
      allow(Feature).to receive(:active?).with(:recurring_products, any_args).and_return(false)

      post "/orders", params: {
        email: "buyer@example.com",
        full_name: "Tadesse Mesfin",
        line_items: [
          {
            permalink: membership.unique_permalink,
            perceived_price_cents: "10000",
            quantity: "1",
            uid: "uid_line_recurring"
          }
        ]
      }, headers: headers.merge("HTTP_ACCEPT_LANGUAGE" => "am")

      expect(response).to have_http_status(:unprocessable_content)
      body = JSON.parse(response.body)
      expect(body["success"]).to be false
      expect(body["error_message"]).to eq("የደንበኝነት ምዝገባዎች፣ የክፍያ ዕቅዶች እና ቅድመ-ትዕዛዞች በአሁኑ ጊዜ በቻፓ አይደገፉም። የአንድ ጊዜ ክፍያዎች በብር (ETB) ብቻ ይደገፋሉ።")
    end
  end

  describe "GET /orders/:id/return" do
    let(:order) { create(:order) }
    let!(:purchase) do
      create(
        :purchase_in_progress,
        order:,
        link: product,
        seller:,
        price_cents: 25000,
        charge_processor_id: "chapa"
      )
    end
    let!(:chapa_tx) do
      ChapaTransaction.create!(
        tx_ref: "chk_ret_#{SecureRandom.hex(6)}",
        order:,
        purchase:,
        amount_santims: 25000,
        amount_decimal: BigDecimal("250.00"),
        currency: "ETB",
        status: "pending"
      )
    end

    it "renders the Inertia ChapaReturn page when payment is still pending" do
      get "/orders/#{order.external_id}/return", headers: headers

      expect(response).to have_http_status(:ok)
    end

    it "redirects to purchase receipt when order is already successful" do
      purchase.mark_successful!

      get "/orders/#{order.external_id}/return", headers: { "HOST" => VALID_REQUEST_HOSTS.first }

      expect(response).to redirect_to(purchase.receipt_url)
    end
  end

  describe "GET /orders/:id/chapa_status" do
    let(:order) { create(:order) }
    let!(:purchase) do
      create(
        :purchase_in_progress,
        order:,
        link: product,
        seller:,
        price_cents: 25000,
        charge_processor_id: "chapa"
      )
    end
    let!(:chapa_tx) do
      ChapaTransaction.create!(
        tx_ref: "chk_status_#{SecureRandom.hex(6)}",
        order:,
        purchase:,
        amount_santims: 25000,
        amount_decimal: BigDecimal("250.00"),
        currency: "ETB",
        status: "pending",
        expires_at: 1.hour.from_now
      )
    end

    it "returns pending status while waiting for gateway confirmation" do
      allow_any_instance_of(Chapa::Client).to receive(:verify_transaction).and_return(
        success: false,
        status: "pending"
      )

      get "/orders/#{order.external_id}/chapa_status", headers: { "HOST" => VALID_REQUEST_HOSTS.first }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["status"]).to eq("pending")
    end

    it "returns success and receipt url once purchase succeeds" do
      purchase.mark_successful!

      get "/orders/#{order.external_id}/chapa_status", headers: { "HOST" => VALID_REQUEST_HOSTS.first }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["status"]).to eq("success")
      expect(body["redirect_url"]).to eq(purchase.receipt_url)
    end

    it "returns cancelled status when transaction is cancelled" do
      chapa_tx.mark_cancelled!

      get "/orders/#{order.external_id}/chapa_status", headers: { "HOST" => VALID_REQUEST_HOSTS.first }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["status"]).to eq("cancelled")
    end

    it "returns expired status when transaction is past its expiration" do
      chapa_tx.update!(expires_at: 10.minutes.ago)

      get "/orders/#{order.external_id}/chapa_status", headers: { "HOST" => VALID_REQUEST_HOSTS.first }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["status"]).to eq("expired")
    end
  end
end
