# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Feature Flags & Non-Launch Feature Gating (Step 12)", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:seller) { create(:user, email: "creator@example.com") }
  let(:product) { create(:product, user: seller, price_cents: 15_000, price_currency_type: "etb") }
  let(:guid) { SecureRandom.hex(16) }

  before do
    host! DOMAIN
    cookies[:_gumroad_guid] = guid
  end

  describe "Default Feature Flag States" do
    it "defaults launch payment rails and gates non-launch features" do
      expect(Feature.active?(:chapa_payments)).to be true
      expect(Feature.active?(:stripe_payments)).to be false
      expect(Feature.active?(:paypal_payments)).to be false
      expect(Feature.active?(:ai_features)).to be false
      expect(Feature.active?(:advanced_us_tax)).to be false
    end
  end

  describe "Checkout & Payment Rail Gating" do
    describe "Presenter props" do
      it "exposes only Chapa when Stripe and PayPal are disabled" do
        card_presenter = Checkout::StripePaymentPresenter.new(
          cart: nil,
          add_products: [],
          clear_cart: false,
          saved_credit_card: nil
        )
        props = card_presenter.props

        expect(props[:chapa_payments_enabled]).to be true
        expect(props[:stripe_payments_enabled]).to be false
        expect(props[:paypal_payments_enabled]).to be false

        checkout_presenter = CheckoutPresenter.new(logged_in_user: seller, ip: "127.0.0.1")
        expect(checkout_presenter.send(:supports_paypal, product)).to be_falsey
      end
    end

    describe "OrdersController payment gating" do
      it "rejects orders prepared via Stripe with 422 when stripe_payments is disabled" do
        post "/orders/prepare", params: {
          line_items: [{ permalink: product.unique_permalink, quantity: 1 }]
        }

        expect(response).to have_http_status(:unprocessable_entity)
        json = JSON.parse(response.body)
        expect(json["error_message"]).to include("Stripe payments are currently disabled")
      end

      it "rejects order creation attempting Stripe when stripe_payments is disabled" do
        post "/orders", params: {
          email: "buyer@example.com",
          full_name: "Abebe Kebede",
          payment_method: "card",
          processor: "stripe",
          line_items: [
            {
              permalink: product.unique_permalink,
              perceived_price_cents: "15000",
              quantity: "1",
              uid: "uid_1"
            }
          ]
        }

        expect(response).to have_http_status(:unprocessable_entity)
        json = JSON.parse(response.body)
        expect(json["error_message"]).to include("Card payments via Stripe are currently disabled")
      end

      it "rejects order creation attempting PayPal when paypal_payments is disabled" do
        post "/orders", params: {
          email: "buyer@example.com",
          full_name: "Abebe Kebede",
          payment_method: "paypal",
          line_items: [
            {
              permalink: product.unique_permalink,
              perceived_price_cents: "15000",
              quantity: "1",
              uid: "uid_2"
            }
          ]
        }

        expect(response).to have_http_status(:unprocessable_entity)
        json = JSON.parse(response.body)
        expect(json["error_message"]).to include("PayPal payments are currently disabled")
      end

      it "successfully routes order creation to Chapa when chapa_payments is enabled" do
        allow_any_instance_of(Chapa::Client).to receive(:initialize_transaction) do |_client, purchase:, return_url:, callback_url:|
          expect(purchase.price_in_currency_cents).to eq(15_000)
          expect(purchase.displayed_price_currency_type.to_s).to eq("etb")
          {
            success: true,
            tx_ref: "arifdrop-#{purchase.external_id}-123",
            checkout_url: "https://checkout.chapa.co/checkout/payment/CHAPA_PAY_URL_123"
          }
        end

        post "/orders", params: {
          email: "buyer@example.com",
          full_name: "Abebe Kebede",
          payment_method: "chapa",
          line_items: [
            {
              permalink: product.unique_permalink,
              perceived_price_cents: "15000",
              quantity: "1",
              uid: "uid_3"
            }
          ]
        }, headers: { "X-Inertia" => "true" }

        expect(response).to have_http_status(:ok)
        body = JSON.parse(response.body)
        expect(body["success"]).to be true
        expect(body["checkout_url"]).to eq("https://checkout.chapa.co/checkout/payment/CHAPA_PAY_URL_123")
      end
    end
  end

  describe "AI Features Gating" do
    it "returns 404 when calling AI product details endpoint with ai_features disabled" do
      allow_any_instance_of(ApplicationController).to receive(:authenticate_user!).and_return(true)
      allow_any_instance_of(ApplicationController).to receive(:current_seller).and_return(seller)

      post "/internal/ai_product_details_generations", params: { prompt: "Digital course on Ethiopian cuisine" }

      expect(response).to have_http_status(:not_found)
      json = JSON.parse(response.body)
      expect(json["error"]).to include("AI features are disabled")
    end

    it "disables AI generation flag in ProductPresenter.new_page_props" do
      props = ProductPresenter.new_page_props(current_seller: seller)
      expect(props[:ai_generation_enabled]).to be false
    end

    it "denies user policy access for store agent" do
      context = SellerContext.new(user: seller, seller:)
      policy = UserPolicy.new(context, seller)
      expect(policy.view_store_agent?).to be false
      expect(policy.use_store_agent?).to be false
      expect(policy.generate_product_details_with_ai?).to be false
    end

    it "prevents Ai::ProductDetailsGeneratorService from initializing" do
      expect do
        Ai::ProductDetailsGeneratorService.new(current_seller: seller)
      end.to raise_error(StandardError, "AI features are disabled")
    end

    it "prevents Ai::StoreAgentService from responding" do
      context = SellerContext.new(user: seller, seller:)
      agent = Ai::StoreAgentService.new(seller:, pundit_user: context)
      expect do
        agent.respond(messages: [{ role: "user", content: "hello" }])
      end.to raise_error(Ai::StoreAgentService::Error, "AI features are disabled")
    end

    it "returns empty buy list in SendYearInReviewEmailJob without calling external LLM" do
      buy_list = SendYearInReviewEmailJob.get_buy_list_from_total(total_amount_cents: 10_000, currency: "etb")
      expect(buy_list).to eq([])
    end
  end

  describe "Tax & US-Specific Flow Suppression" do
    it "bypasses sales tax calculation for ETB products" do
      calc = SalesTaxCalculator.new(
        product:,
        price_cents: 15_000,
        buyer_location: { country: "US", postal_code: "90210" }
      )
      result = calc.calculate
      expect(result.tax_cents).to eq(0)
    end

    it "bypasses tax calculation in Purchase for ETB orders" do
      purchase = create(:purchase, link: product, price_cents: 15_000, displayed_price_cents: 15_000, displayed_price_currency_type: "etb", country: "United States")
      purchase.send(:calculate_taxes)
      expect(purchase.tax_cents.to_i).to eq(0)
      expect(purchase.gumroad_tax_cents.to_i).to eq(0)
    end

    it "suppresses US SSN and tax ID requirements in SettingsPresenter" do
      context = SellerContext.new(user: seller, seller:)
      presenter = SettingsPresenter.new(pundit_user: context)
      props = presenter.payments_props

      expect(props[:user][:need_full_ssn]).to be false
      expect(props[:user][:individual_tax_id_needed_countries]).to eq([])
    end

    it "hides PayPal and Stripe Connect in SettingsPresenter when disabled" do
      context = SellerContext.new(user: seller, seller:)
      presenter = SettingsPresenter.new(pundit_user: context)
      props = presenter.payments_props

      expect(props[:bank_account_details][:show_paypal]).to be false
      expect(props[:stripe_connect][:has_connected_stripe]).to be false
    end
  end
end
