# frozen_string_literal: true

class ReceiptPresenter::GifteeManageSubscription
  include ActionView::Helpers::UrlHelper
  include BasePrice::Recurrence

  def initialize(chargeable)
    @chargeable = chargeable
  end

  def note
    @_note ||= begin
      return unless gifted_subscription?

      # Get the subscription associated with the original purchase
      # Due to concurrency issues while creating the purchase, giftee purchase many not have the subscription yet
      subscription = chargeable.gift_received.gifter_purchase.subscription

      url = Rails.application.routes.url_helpers.manage_subscription_url(
        subscription.external_id,
        { host: UrlService.domain_with_protocol },
      )

      settings_link = link_to(I18n.t("mailers.customer.receipt.subscription_settings", default: "subscription settings"), url, target: "_blank")
      I18n.t("mailers.customer.receipt.giftee_subscription_note_html", period: single_period_indicator(subscription.recurrence), settings_link:).html_safe
    end
  end

  private
    attr_reader :chargeable

    def gifted_subscription?
      chargeable.is_a?(Purchase) && chargeable.is_gift_receiver_purchase && chargeable.link.is_recurring_billing
    end
end
