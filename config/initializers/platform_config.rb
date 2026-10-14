# frozen_string_literal: true

module PlatformConfig
  APP_NAME = GlobalConfig.get("APP_NAME", "ArifDrop")
  APP_NAME_AM = GlobalConfig.get("APP_NAME_AM", "አሪፍድሮፕ")
  SUPPORT_EMAIL = GlobalConfig.get("SUPPORT_EMAIL", "support@arifdrop.com")
  STATEMENT_DESCRIPTOR = GlobalConfig.get("STATEMENT_DESCRIPTOR", "ARIFDROP*")
  LEGAL_NAME = GlobalConfig.get("LEGAL_NAME", "ArifDrop")
  LEGAL_ADDRESS = GlobalConfig.get("LEGAL_ADDRESS", "Addis Ababa, Ethiopia")
  DEFAULT_CURRENCY = "ETB"

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
      SUPPORT_EMAIL
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

    def flat_fee_percent
      Purchase::GUMROAD_FLAT_FEE_PER_THOUSAND / 10.0
    end

    def discover_fee_percent
      Purchase::GUMROAD_DISCOVER_FEE_PER_THOUSAND / 10.0
    end

    def fixed_fee_cents
      Purchase::GUMROAD_FIXED_FEE_CENTS
    end

    def processor_fee_percent
      Purchase::PROCESSOR_FEE_PER_THOUSAND / 10.0
    end

    def processor_fixed_fee_cents
      Purchase::PROCESSOR_FIXED_FEE_CENTS
    end

    def to_h(locale = I18n.locale)
      {
        app_name: app_name(locale),
        app_name_en: APP_NAME,
        app_name_am: APP_NAME_AM,
        support_email: SUPPORT_EMAIL,
        statement_descriptor: STATEMENT_DESCRIPTOR,
        legal_name: LEGAL_NAME,
        legal_address: LEGAL_ADDRESS,
        default_currency: DEFAULT_CURRENCY,
        flat_fee_percent:,
        discover_fee_percent:,
        fixed_fee_cents:
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
      statement_descriptor: PlatformConfig.statement_descriptor
    }
    super(*args, **defaults.merge(options))
  end
  alias_method :t, :translate
end

I18n.singleton_class.prepend(PlatformI18nDefaults)
