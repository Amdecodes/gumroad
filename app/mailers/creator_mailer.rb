# frozen_string_literal: true

class CreatorMailer < ApplicationMailer
  helper MailerHelper
  helper ApplicationHelper
  helper CurrencyHelper
  layout "layouts/email"

  def gumroad_day_fee_saved(seller_id:, to_email: nil)
    @announcement = true

    seller = User.find(seller_id)
    email = to_email.presence || seller.email

    @fee_saved_amount = seller.gumroad_day_saved_fee_amount
    return unless @fee_saved_amount.present?

    with_recipient_locale(seller) do
      mail to: email, subject: t("mailers.creator.gumroad_day_fee_saved.subject", fee: @fee_saved_amount, app_name: PlatformConfig::APP_NAME, default: "You saved #{@fee_saved_amount} in fees on #{PlatformConfig::APP_NAME} Day!")
    end
  end

  def year_in_review(seller:, year:, analytics_data:, payout_csv_url: nil, recipient: nil)
    @seller = seller
    @year = year
    @analytics_data = analytics_data
    @payout_csv_url = payout_csv_url
    email = recipient.presence || seller.email

    with_recipient_locale(seller) do
      mail to: email, subject: t("mailers.creator.year_in_review.subject", year: year, default: "Your #{year} in review")
    end
  end

  def bundles_marketing(seller_id:, bundles: [])
    seller = User.find(seller_id)
    @currency_type = seller.currency_type
    @bundles = bundles
    with_recipient_locale(seller) do
      mail to: seller.form_email, subject: t("mailers.creator.bundles_marketing.subject", default: "Join top creators who have sold over $300,000 of bundles")
    end
  end

  def top_creator_announcement(user_id:)
    user = User.alive.not_suspended.find_by(id: user_id)
    return unless user

    email = user.form_email
    return unless EmailFormatValidator.valid?(email)

    with_recipient_locale(user) do
      @subject = t("mailers.creator.top_creator_announcement.subject", default: "You're a Top Creator!")

      mail(
        to: email,
        from: "#{PlatformConfig::APP_NAME} <gumroad@#{CREATOR_CONTACTING_CUSTOMERS_MAIL_DOMAIN}>",
        subject: @subject,
        delivery_method_options: MailerInfo.random_delivery_method_options(domain: :creators)
      )
    end
  end

  def scheduled_payout_chargeback_hold(scheduled_payout_id:)
    @scheduled_payout = ScheduledPayout.find_by(id: scheduled_payout_id)
    return if @scheduled_payout.nil?

    user = @scheduled_payout.user
    email = user.form_email
    return if !EmailFormatValidator.valid?(email)

    with_recipient_locale(user) do
      @subject = t("mailers.creator.scheduled_payout_chargeback_hold.subject", default: "Your payout has been delayed")

      mail(
        to: email,
        subject: @subject
      )
    end
  end

  # Links to the product's Share tab, not Settings, so the post is in front of the seller
  # when they return from reconnecting.
  def marketing_x_reconnect(marketing_action_id:)
    @action = Marketing::Action.awaiting_reconnect.find_by(id: marketing_action_id)
    return if @action.nil?

    seller = @action.user
    email = seller.form_email
    return unless EmailFormatValidator.valid?(email)

    @product = @action.link
    @share_url = "#{UrlService.domain_with_protocol}/products/#{@product.unique_permalink}/edit/share"
    with_recipient_locale(seller) do
      @subject = t("mailers.creator.marketing_x_reconnect.subject", default: "Reconnect X to send your launch post")

      mail(to: email, subject: @subject)
    end
  end
end
