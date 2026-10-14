# frozen_string_literal: true

class ApplicationMailer < ActionMailer::Base
  include RescueSmtpErrors, MailerHelper
  helper MailerHelper
  helper ViteRails::TagHelpers
  helper ApplicationHelper

  # Constants for Gumroad emails
  {
    ADMIN_EMAIL: "hi@#{DEFAULT_EMAIL_DOMAIN}",
    DEVELOPERS_EMAIL: "developers@#{DEFAULT_EMAIL_DOMAIN}",
    FINANCE_EMAIL: "finance@#{DEFAULT_EMAIL_DOMAIN}",
    NOREPLY_EMAIL: "noreply@#{DEFAULT_EMAIL_DOMAIN}",
    PAYMENTS_EMAIL: "payments@#{DEFAULT_EMAIL_DOMAIN}",
    RISK_EMAIL: "risk@#{DEFAULT_EMAIL_DOMAIN}",
    SUPPORT_EMAIL: "support@#{DEFAULT_EMAIL_DOMAIN}"
  }.each do |key, email|
    const_set(key, email)
    const_set("#{key}_WITH_NAME", email_address_with_name(email, PlatformConfig::APP_NAME))
  end

  default from: NOREPLY_EMAIL_WITH_NAME,
          delivery_method_options: -> { MailerInfo.random_delivery_method_options(domain: :gumroad) }

  after_action :validate_from_email_domain!

  ruby2_keywords def process(name, *args)
    super
    redirect_united_internet_recipients_to_sendgrid!
    set_custom_headers(name, args)
  end

  private
    # Safety net for MailerInfo::UNITED_INTERNET_RECIPIENT_DOMAINS. Mailers pass
    # `to:` so the provider is picked up front; this catches the ones that don't,
    # which is easy to miss when writing a new mailer. Runs post-build so the
    # recipients are already known, and before set_custom_headers, which derives
    # X-GUM-Email-Provider from the SMTP address we end up with.
    def redirect_united_internet_recipients_to_sendgrid!
      return if message.class == ActionMailer::Base::NullMail
      # `destinations`, not `to`: cc and bcc are envelope recipients too, and only
      # that recipient's copy bounces, so the failure is silent. AffiliateMailer
      # addresses the affiliate and cc's the seller.
      return unless MailerInfo.force_sendgrid_for_recipients?(message.destinations)

      sendgrid_settings = MailerInfo::DeliveryMethod.sendgrid_equivalent_options(message.delivery_method.settings)
      return if sendgrid_settings.nil?

      message.delivery_method.settings = message.delivery_method.settings.merge(sendgrid_settings)
    end

    def from_email_address_with_name(name = "", email = NOREPLY_EMAIL)
      name = from_email_address_name(name)
      email_address_with_name(email, name)
    end

    def set_custom_headers(mailer_action, mailer_args)
      return if self.message.class == ActionMailer::Base::NullMail

      # Ensure the correct email provider for building the headers is used
      email_provider = self.message.delivery_method.settings[:address] == RESEND_SMTP_ADDRESS ? MailerInfo::EMAIL_PROVIDER_RESEND : MailerInfo::EMAIL_PROVIDER_SENDGRID
      custom_headers = MailerInfo.build_headers(mailer_class: self.class.name, mailer_method: mailer_action.to_s, mailer_args:, email_provider:)
      custom_headers.each do |name, value|
        headers[name] = value
      end
    end

    # From email domain must match the domain associated with the API key on Resend
    def validate_from_email_domain!
      return if message.subject.nil?

      expected_domain = message.delivery_method.settings[:domain]
      message.from.each do |from|
        next if from.split("@").last == expected_domain

        raise "From email `#{from}` domain does not match expected delivery domain `#{expected_domain}`"
      end
    end

    def with_recipient_locale(target = nil, &block)
      resolved_locale = resolve_recipient_locale(target)
      I18n.with_locale(resolved_locale, &block)
    end

    def resolve_recipient_locale(target)
      case target
      when Symbol, String
        target.to_s.presence_in(I18n.available_locales.map(&:to_s)) || I18n.default_locale
      when Purchase
        target.locale.presence || target.user&.locale.presence || I18n.default_locale
      when Subscription
        target.original_purchase&.locale.presence || target.user&.locale.presence || I18n.default_locale
      when Preorder
        target.authorization_purchase&.locale.presence || target.user&.locale.presence || I18n.default_locale
      when Shipment
        target.purchase&.locale.presence || target.purchase&.user&.locale.presence || I18n.default_locale
      when Dispute
        target.disputable&.try(:purchase_for_dispute_evidence)&.locale.presence ||
          target.try(:purchase)&.locale.presence ||
          target.try(:purchase)&.user&.locale.presence ||
          I18n.default_locale
      when Cart
        target.user&.locale.presence || I18n.default_locale
      when ProductReview
        target.purchase&.locale.presence || target.purchase&.user&.locale.presence || I18n.default_locale
      when Call
        target.purchase&.locale.presence || target.purchase&.user&.locale.presence || I18n.default_locale
      when User
        target.locale.presence || I18n.default_locale
      when Order
        target.purchases.first&.locale.presence || target.user&.locale.presence || I18n.default_locale
      else
        if target.respond_to?(:locale) && target.locale.present?
          target.locale
        elsif target.respond_to?(:original_purchase) && target.original_purchase&.locale.present?
          target.original_purchase.locale
        elsif target.respond_to?(:authorization_purchase) && target.authorization_purchase&.locale.present?
          target.authorization_purchase.locale
        elsif target.respond_to?(:purchases) && target.purchases.first&.locale.present?
          target.purchases.first.locale
        elsif target.respond_to?(:purchaser) && target.purchaser&.locale.present?
          target.purchaser.locale
        elsif target.respond_to?(:orderable) && target.orderable.respond_to?(:locale) && target.orderable.locale.present?
          target.orderable.locale
        elsif target.respond_to?(:user) && target.user&.locale.present?
          target.user.locale
        else
          I18n.default_locale
        end
      end
    end
end
