# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Localization (English & Amharic)" do
  include Devise::Test::IntegrationHelpers

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

    it "prioritizes explicit ?locale= param over user and cookie, persisting to user and cookie" do
      user = create(:user, locale: "en")
      sign_in user
      cookies[:locale] = "en"

      get "/discover?locale=am"
      expect(response).to have_http_status(:ok)
      expect(I18n.locale).to eq(:am)
      expect(cookies[:locale]).to eq("am")
      expect(user.reload.locale).to eq("am")
    end

    it "prioritizes logged-in user's saved choice over cookie" do
      user = create(:user, locale: "am")
      sign_in user
      cookies[:locale] = "en"

      get "/discover"
      expect(response).to have_http_status(:ok)
      expect(I18n.locale).to eq(:am)
      expect(cookies[:locale]).to eq("am")
    end

    it "prioritizes cookie over Accept-Language header" do
      cookies[:locale] = "am"
      get "/login", headers: { "HTTP_ACCEPT_LANGUAGE" => "en-US,en;q=0.9" }
      expect(response).to have_http_status(:ok)
      expect(I18n.locale).to eq(:am)
    end

    it "resolves Accept-Language header when no param, user, or cookie is present" do
      get "/login", headers: { "HTTP_ACCEPT_LANGUAGE" => "am,en;q=0.8" }
      expect(response).to have_http_status(:ok)
      expect(I18n.locale).to eq(:am)
    end

    it "ignores unsupported languages in Accept-Language and falls back to :en" do
      get "/login", headers: { "HTTP_ACCEPT_LANGUAGE" => "fr-FR,fr;q=0.9,es;q=0.8" }
      expect(response).to have_http_status(:ok)
      expect(I18n.locale).to eq(:en)
    end
  end

  describe "Cookie Attributes & Configuration" do
    it "sets host-only cookie in development" do
      allow(Rails.env).to receive(:production?).and_return(false)
      allow(Rails.env).to receive(:staging?).and_return(false)

      get "/login?locale=am"
      locale_cookie = Array(response.headers["set-cookie"]).find { |c| c.start_with?("locale=") }
      expect(locale_cookie).to include("locale=am")
      expect(locale_cookie).not_to include("domain=")
    end

    it "sets root domain cookie in production" do
      allow(Rails.env).to receive(:production?).and_return(true)
      allow(Rails.env).to receive(:staging?).and_return(false)

      options = ApplicationController.locale_cookie_options(:am)
      expect(options[:domain]).to eq(:all)
      expect(options[:tld_length]).to eq(2)
      expect(options[:httponly]).to be(false)
    end

    it "sets root domain cookie in staging" do
      allow(Rails.env).to receive(:production?).and_return(false)
      allow(Rails.env).to receive(:staging?).and_return(true)

      options = ApplicationController.locale_cookie_options(:am)
      expect(options[:domain]).to eq(:all)
      expect(options[:tld_length]).to eq(3)
    end
  end

  describe "Locale Switcher Endpoint (POST /locale & GET /locale/:locale)" do
    it "switches to Amharic via JSON POST /locale and updates logged-in user" do
      user = create(:user, locale: "en")
      sign_in user

      post "/locale", params: { locale: "am" }.to_json, headers: {
        "CONTENT_TYPE" => "application/json",
        "ACCEPT" => "application/json"
      }
      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["success"]).to be(true)
      expect(json["locale"]).to eq("am")
      expect(cookies[:locale]).to eq("am")
      expect(user.reload.locale).to eq("am")
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

  describe "Cross-Host Links" do
    let(:seller) { create(:named_seller) }
    let(:product) { create(:product, user: seller) }

    it "carries ?locale=<current> in product long_url" do
      I18n.with_locale(:am) do
        expect(product.long_url).to include("locale=am")
      end
      I18n.with_locale(:en) do
        expect(product.long_url).to include("locale=en")
      end
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

  describe "Settings > Profile Language Setting" do
    let(:seller) { create(:user, locale: "en") }

    around do |example|
      original = ActionController::Base.allow_forgery_protection
      ActionController::Base.allow_forgery_protection = false
      example.run
    ensure
      ActionController::Base.allow_forgery_protection = original
    end

    it "updates users.locale and syncs cookie when saving profile settings" do
      sign_in seller
      put "/profile", params: { user: { locale: "am" } }, as: :json
      expect(response).to have_http_status(:ok)
      expect(seller.reload.locale).to eq("am")
      expect(cookies[:locale]).to eq("am")
      expect(I18n.locale).to eq(:am)
    end
  end
end
