# frozen_string_literal: true

# ArifDrop Localization Configuration
# Strictly supports English (:en) and Amharic (:am) in production.
# :pseudo is additionally available in development and test for translation coverage auditing.
# Any visible UI text NOT wrapped in ⟦àéíxx⟧ is untranslated.

module PseudoLocaleBackend
  VOWEL_MAP = { "a" => "á", "e" => "é", "i" => "í", "o" => "ó", "u" => "ú",
                "A" => "Á", "E" => "É", "I" => "Í", "O" => "Ó", "U" => "Ú" }.freeze

  def translate(locale, key, options = {})
    if locale.to_sym == :pseudo
      begin
        raw = super(:en, key, options)
        pseudo_wrap(raw)
      rescue I18n::MissingTranslationData
        "⟦MISSING:#{key}⟧"
      end
    else
      super
    end
  end

  private
    def pseudo_wrap(value)
      case value
      when String
        accented = value.gsub(/[aeiouAEIOU]/) { |c| VOWEL_MAP[c] || c }
        target_len = (value.length * 1.3).ceil
        pad = "ẋ" * [target_len - accented.length, 0].max
        "⟦#{accented}#{pad}⟧"
      when Hash
        value.transform_values { |v| pseudo_wrap(v) }
      when Array
        value.map { |v| pseudo_wrap(v) }
      else
        value
      end
    end
end

if !Rails.env.production? && !Rails.env.staging?
  I18n.backend.singleton_class.prepend(PseudoLocaleBackend)
  Rails.application.config.i18n.available_locales = %i[en am pseudo]
else
  Rails.application.config.i18n.available_locales = %i[en am]
end

Rails.application.config.i18n.default_locale = :en
Rails.application.config.i18n.fallbacks = [:en]
