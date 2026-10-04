# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Localization (English & Amharic)" do
  let(:user) { create(:user) }

  before do
    host! DOMAIN
  end

  describe "Locale Resolution Pipeline in ApplicationController" do
    it "defaults to English (:en) when no preference is provided" do
      get "/login"
      expect(response).to have_http_status(:ok)
      expect(I18n.locale).to eq(:en)
      expect(cookies[:locale]).to eq("en")
    end

    it "resolves Amharic (:am) when requested via query param ?locale=am" do
      get "/login?locale=am"
      expect(response).to have_http_status(:ok)
      expect(I18n.locale).to eq(:am)
      expect(cookies[:locale]).to eq("am")
    end

    it "resolves Amharic (:am) when provided via cookie" do
      cookies[:locale] = "am"
      get "/login"
      expect(response).to have_http_status(:ok)
      expect(I18n.locale).to eq(:am)
    end

    it "safely falls back to :en when an unsupported locale is supplied" do
      get "/login?locale=fr"
      expect(response).to have_http_status(:ok)
      expect(I18n.locale).to eq(:en)
      expect(cookies[:locale]).to eq("en")
    end

    it "shares locale and supported_locales in Inertia shared props" do
      get "/login?locale=am", headers: { "X-Inertia" => "true" }
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["props"]["locale"]).to eq("am")
      expect(body["props"]["supported_locales"]).to eq(%w[en am])
    end
  end

  describe "Locale Switcher Endpoint (POST /locale & GET /locale/:locale)" do
    it "switches to Amharic via JSON POST /locale" do
      post "/locale", params: { locale: "am" }.to_json, headers: {
        "CONTENT_TYPE" => "application/json",
        "ACCEPT" => "application/json"
      }
      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["success"]).to be(true)
      expect(json["locale"]).to eq("am")
      expect(cookies[:locale]).to eq("am")
    end

    it "switches via GET /locale/am and redirects back" do
      get "/locale/am", headers: { "HTTP_REFERER" => "http://#{DOMAIN}/admin" }
      expect(response).to redirect_to("http://#{DOMAIN}/admin")
      expect(cookies[:locale]).to eq("am")
    end

    it "falls back to default locale for invalid locale requests" do
      post "/locale", params: { locale: "xyz" }.to_json, headers: {
        "CONTENT_TYPE" => "application/json",
        "ACCEPT" => "application/json"
      }
      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["locale"]).to eq("en")
      expect(cookies[:locale]).to eq("en")
    end
  end

  describe "Mailer Localization" do
    let(:seller) { create(:named_seller) }
    let(:product) { create(:membership_product, subscription_duration: "monthly", user: seller, price_currency_type: "etb") }

    let!(:purchase) do
      travel_to(Time.zone.parse("2026-10-01 12:00:00")) do
        create(
          :purchase,
          link: product,
          seller:,
          subscription:,
          is_original_subscription_purchase: true,
          purchase_state: "successful",
          succeeded_at: Time.current,
          price_cents: 25000,
          displayed_price_cents: 25000,
          displayed_price_currency_type: "etb"
        )
      end
    end

    context "when subscriber locale is Amharic (:am)" do
      let(:amharic_subscriber) { create(:user, locale: "am") }
      let(:subscription) { create(:subscription, link: product, user: amharic_subscriber) }

      it "renders the reminder email with Amharic subject and body" do
        mail = CustomerLowPriorityMailer.subscription_renewal_reminder(subscription.id)
        expect(mail.subject).to eq("የአባልነት ምዝገባ ዕድሳት ማስታወሻ")
        expect(mail.body.encoded).to include("ዕድሳት እንደሚፈልግ ማስታወሻ ነው")
        expect(mail.body.encoded).to include("ምዝገባን ያስተዳድሩ")
      end
    end

    context "when subscriber locale is English (:en)" do
      let(:english_subscriber) { create(:user, locale: "en") }
      let(:subscription) { create(:subscription, link: product, user: english_subscriber) }

      it "renders the reminder email with English subject and body" do
        mail = CustomerLowPriorityMailer.subscription_renewal_reminder(subscription.id)
        expect(mail.subject).to eq("Upcoming automatic membership renewal")
        expect(mail.body.encoded).to include("will automatically renew on")
        expect(mail.body.encoded).to include("Manage membership")
      end
    end
  end
end
