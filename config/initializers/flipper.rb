# frozen_string_literal: true

Rails.application.config.after_initialize do
  unless Flipper.exist?(:chapa_payments)
    Flipper.enable(:chapa_payments)
  end
  unless Flipper.exist?(:etb)
    Flipper.enable(:etb)
  end
  unless Flipper.exist?(:amharic)
    Flipper.enable(:amharic)
  end
  unless Flipper.exist?(:stripe_payments)
    Flipper.disable(:stripe_payments)
  end
  unless Flipper.exist?(:paypal_payments)
    Flipper.disable(:paypal_payments)
  end
  unless Flipper.exist?(:ai_features)
    Flipper.disable(:ai_features)
  end
  unless Flipper.exist?(:advanced_us_tax)
    Flipper.disable(:advanced_us_tax)
  end
  unless Flipper.exist?(:third_party_analytics)
    Flipper.disable(:third_party_analytics)
  end
  unless Flipper.exist?(:social_connections)
    Flipper.disable(:social_connections)
  end
  unless Flipper.exist?(:recurring_products)
    Flipper.disable(:recurring_products)
  end
  unless Flipper.exist?(:advanced_settings)
    Flipper.disable(:advanced_settings)
  end
rescue => e
  Rails.logger.warn("Flipper initialization warning: #{e.message}")
end
