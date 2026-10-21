# frozen_string_literal: true

module PlatformConfig
  APP_NAME = GlobalConfig.get("APP_NAME", "ArifDrop")
  APP_NAME_AM = GlobalConfig.get("APP_NAME_AM", "አሪፍድሮፕ")
  SUPPORT_EMAIL = Rails.env.production? ? GlobalConfig.get("SUPPORT_EMAIL") : GlobalConfig.get("SUPPORT_EMAIL", "support@arifdrop.com")
  STATEMENT_DESCRIPTOR = Rails.env.production? ? GlobalConfig.get("STATEMENT_DESCRIPTOR") : GlobalConfig.get("STATEMENT_DESCRIPTOR", "ARIFDROP*")
  LEGAL_NAME = GlobalConfig.get("LEGAL_NAME")
  LEGAL_ADDRESS = GlobalConfig.get("LEGAL_ADDRESS")
  DEFAULT_CURRENCY = "ETB"
  REQUIRED_PRODUCTION_KEYS = %w[
    LEGAL_NAME
    LEGAL_ADDRESS
    SUPPORT_EMAIL
    STATEMENT_DESCRIPTOR
    CUSTOMERS_MAIL_DOMAIN
    FOLLOWER_CONFIRMATION_MAIL_DOMAIN
    CREATOR_CONTACTING_CUSTOMERS_MAIL_DOMAIN
    CHAPA_SECRET_KEY
    CHAPA_WEBHOOK_SECRET
  ].freeze

  class << self
    def app_name(locale = I18n.locale)
      locale.to_s == "am" ? APP_NAME_AM : APP_NAME
    end

    def app_name_en
      APP_NAME
    end

    def app_name_am
      APP_NAME_AM
    end

    def support_email
      SUPPORT_EMAIL.presence || (defined?(DEFAULT_EMAIL_DOMAIN) && DEFAULT_EMAIL_DOMAIN.present? ? "support@#{DEFAULT_EMAIL_DOMAIN}" : "support@arifdrop.com")
    end

    def statement_descriptor
      STATEMENT_DESCRIPTOR
    end

    def legal_name
      LEGAL_NAME
    end

    def legal_address
      LEGAL_ADDRESS
    end

    def kindle_sender_email
      "noreply@#{CUSTOMERS_MAIL_DOMAIN}"
    end
    alias_method :kindle_email, :kindle_sender_email

    def flat_fee_percent
      Purchase::PLATFORM_FLAT_FEE_PER_THOUSAND / 10.0
    end

    def discover_fee_percent
      Purchase::DISCOVER_FLAT_FEE_PER_THOUSAND / 10.0
    end

    def fixed_fee_cents
      Purchase::PLATFORM_FIXED_FEE_CENTS
    end

    def processor_fee_percent
      Purchase::PROCESSOR_FEE_PER_THOUSAND / 10.0
    end

    def processor_fixed_fee_cents
      Purchase::PROCESSOR_FIXED_FEE_CENTS
    end

    def twitter_url
      GlobalConfig.get("PLATFORM_TWITTER_URL")
    end

    def youtube_url
      GlobalConfig.get("PLATFORM_YOUTUBE_URL")
    end

    def instagram_url
      GlobalConfig.get("PLATFORM_INSTAGRAM_URL")
    end

    def facebook_url
      GlobalConfig.get("PLATFORM_FACEBOOK_URL")
    end

    def pinterest_url
      GlobalConfig.get("PLATFORM_PINTEREST_URL")
    end

    def social_links
      {
        twitter: twitter_url,
        youtube: youtube_url,
        instagram: instagram_url,
        facebook: facebook_url,
        pinterest: pinterest_url
      }.compact
    end

    def validate_production_config!(env = Rails.env)
      if env.development?
        dev_chapa_key = ENV["CHAPA_SECRET_KEY"].presence || Rails.application.credentials.dig(:chapa, :secret_key)
        if dev_chapa_key.present? && !dev_chapa_key.start_with?("CHASECK_TEST")
          Rails.logger.warn("[SECURITY WARNING] Live Chapa secret key detected in development environment! Please use a test key (CHASECK_TEST-*) in dev.")
        end
      end

      chapa_url = ENV["CHAPA_API_URL"].presence || GlobalConfig.get("CHAPA_API_URL")
      if !env.test? && !env.development? && chapa_url.present? && chapa_url.chomp("/") != "https://api.chapa.co/v1"
        raise "Security boot failure: CHAPA_API_URL outside test/dev must only be https://api.chapa.co/v1. Received: #{chapa_url}"
      end

      return unless env.production?

      missing = REQUIRED_PRODUCTION_KEYS.select do |key|
        val = GlobalConfig.get(key)
        val = GlobalConfig.get("#{key}_PROD") if val.blank?
        val = ENV[key] if val.blank?
        val.blank?
      end
      if missing.any?
        raise "Missing required platform configuration in production: #{missing.join(', ')}. " \
              "Please configure these via ENV or Rails credentials."
      end

      prod_chapa_key = GlobalConfig.get("CHAPA_SECRET_KEY").presence || ENV["CHAPA_SECRET_KEY"].presence || Rails.application.credentials.dig(:chapa, :secret_key)
      if prod_chapa_key.to_s.start_with?("CHASECK_TEST")
        raise "Security boot failure: Test mode key (CHASECK_TEST) is forbidden in production! Please provide a live Chapa secret key."
      end
    end

    def server_boot?
      return true if defined?(Rails::Server)
      return true if File.basename($PROGRAM_NAME).include?("puma")
      return true if ENV["PUMA_BOOT"].present? || ENV["SERVER_BOOT"].present?

      false
    end

    def to_h(locale = I18n.locale)
      {
        app_name: app_name(locale),
        app_name_en: APP_NAME,
        app_name_am: APP_NAME_AM,
        support_email:,
        statement_descriptor: STATEMENT_DESCRIPTOR,
        legal_name:,
        legal_address:,
        kindle_sender_email:,
        default_currency: DEFAULT_CURRENCY,
        flat_fee_percent:,
        discover_fee_percent:,
        fixed_fee_cents:,
        social_links:
      }
    end
  end
end

module PlatformI18nDefaults
  def translate(*args, **options)
    locale = options[:locale] || I18n.locale
    defaults = {
      app_name: PlatformConfig.app_name(locale),
      support_email: PlatformConfig.support_email,
      statement_descriptor: PlatformConfig.statement_descriptor,
      kindle_email: PlatformConfig.kindle_sender_email
    }
    super(*args, **defaults.merge(options))
  end
  alias_method :t, :translate
end

I18n.singleton_class.prepend(PlatformI18nDefaults)

Rails.application.config.after_initialize do
  if PlatformConfig.server_boot?
    PlatformConfig.validate_production_config!
  end
end
