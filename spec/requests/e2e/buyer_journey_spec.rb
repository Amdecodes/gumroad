# frozen_string_literal: true

require "spec_helper"

RSpec.describe "E2E: Buyer & Checkout Journey", type: :request do
  let(:seller) { create(:user, username: "ethiopiancreator") }
  let(:secret_key) { "chapa_secret_key_buyer_e2e" }
  let(:product) do
    create(:product,
           user: seller,
           price_cents: 50000,
           price_currency_type: "etb",
           require_shipping: false)
  end
  let!(:product_file) { create(:product_file, link: product, display_name: "guide.pdf") }
  let!(:offer_code) do
    code = create(:offer_code, user: seller, amount_percentage: 20, code: "DISCOUNT20")
    code.products << product
    code
  end
  let(:guid) { SecureRandom.hex(16) }

  before do
    host! DOMAIN
    cookies[:_gumroad_guid] = guid
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with("CHAPA_WEBHOOK_SECRET").and_return(secret_key)
    allow(ENV).to receive(:[]).with("CHAPA_SECRET_KEY").and_return(secret_key)
  end

  it "executes the complete buyer flow from localized discovery to verified digital delivery" do
    # 1. Product page visit with Amharic locale
    allow_any_instance_of(LinksController).to receive(:check_if_needs_redirect).and_return(nil)
    get "/l/#{product.unique_permalink}", params: { locale: "am" }
    expect(response).to have_http_status(:ok)

    # 2. Checkout submission with 20% discount (50000 santims - 20% = 40000 santims)
    allow_any_instance_of(Chapa::Client).to receive(:initialize_transaction) do |_client, purchase:, return_url:, callback_url:|
      expect(purchase.price_in_currency_cents).to eq(40000)
      expect(purchase.displayed_price_currency_type.to_s.downcase).to eq("etb")
      expect(return_url).to include(purchase.external_id)
      expect(callback_url).to include("/webhooks/chapa")

      {
        success: true,
        tx_ref: "arifdrop-#{purchase.external_id}-e2e1",
        checkout_url: "https://checkout.chapa.co/checkout/payment/CHAPA_E2E_PAY"
      }
    end

    post "/orders", params: {
      email: "buyer_e2e@example.com",
      full_name: "Abebe Bikila",
      line_items: [
        {
          permalink: product.unique_permalink,
          discount_code: "DISCOUNT20",
          perceived_price_cents: "40000",
          quantity: "1",
          uid: "uid_e2e_buyer"
        }
      ]
    }, headers: { "X-Inertia" => "true" }

    expect(response).to have_http_status(:ok)
    order_data = JSON.parse(response.body)
    expect(order_data["success"]).to be true
    expect(order_data["checkout_url"]).to eq("https://checkout.chapa.co/checkout/payment/CHAPA_E2E_PAY")

    tx_ref = order_data["tx_ref"]
    purchase = Purchase.find_by_processor_transaction_id(tx_ref)
    expect(purchase).to be_present
    expect(purchase.purchase_state).to eq("in_progress")
    expect(purchase.price_in_currency_cents).to eq(40000)

    # 3. Tamper Resistance: Even if a redirect exists for a pending purchase, access must be 403 Forbidden
    unconfirmed_redirect = create(:url_redirect, purchase:, link: product)
    get url_redirect_download_product_files_path(unconfirmed_redirect.token, product_file_ids: [product_file.external_id])
    expect(response).to have_http_status(:forbidden)

    # 4. Webhook verification from Chapa gateway
    webhook_payload = {
      event: "charge.complete",
      tx_ref:,
      status: "success"
    }.to_json

    signature = OpenSSL::HMAC.hexdigest("SHA256", secret_key, webhook_payload)

    allow_any_instance_of(Chapa::Client).to receive(:verify_transaction).with(tx_ref).and_return({
                                                                                                   success: true,
                                                                                                   status: "success",
                                                                                                   amount: 400.0,
                                                                                                   currency: "ETB",
                                                                                                   reference: "chapa_gw_ref_999"
                                                                                                 })

    seller.balances.last&.balance_cents || 0

    post "/webhooks/chapa", params: webhook_payload, headers: {
      "CONTENT_TYPE" => "application/json",
      "Chapa-Signature" => signature
    }

    expect(response).to have_http_status(:ok)
    webhook_res = JSON.parse(response.body)
    expect(webhook_res["status"]).to eq("success")

    # 5. Purchase state & seller balance verification in integer santims
    purchase.reload
    expect(purchase.successful?).to be true
    expect(purchase.charge_processor_id).to eq("chapa")

    seller_balance_tx = BalanceTransaction.find_by(purchase_id: purchase.id)
    expect(seller_balance_tx).to be_present
    net_earned = seller_balance_tx.holding_amount_net_cents.presence || seller_balance_tx.issued_amount_net_cents
    expect(net_earned).to be > 0

    # 6. Customer return callback redirect
    get chapa_callback_purchase_path(purchase.external_id)
    expect(response).to redirect_to(receipt_purchase_path(purchase.external_id, email: purchase.email))

    # 7. Authenticated download delivery via expiring signed URL
    purchase.update_columns(ip_address: "127.0.0.1")
    allow_any_instance_of(UrlRedirect).to receive(:signed_location_for_file).with(product_file)
      .and_return("https://storage.arifdrop.com/attachments/guide.pdf?X-Amz-Expires=1800")

    get url_redirect_download_product_files_path(purchase.url_redirect.token, product_file_ids: [product_file.external_id])
    expect(response).to have_http_status(:redirect)
    expect(response.location).to include("X-Amz-Expires=1800")
  end
end
