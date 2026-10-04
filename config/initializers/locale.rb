# frozen_string_literal: true

# ArifDrop Localization Configuration
# Strictly supports English (:en) and Amharic (:am)
Rails.application.config.i18n.available_locales = %i[en am]
Rails.application.config.i18n.default_locale = :en
Rails.application.config.i18n.fallbacks = [:en]
