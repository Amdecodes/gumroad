# frozen_string_literal: true

class ReceiptPresenter::FooterInfo
  include ActionView::Helpers::UrlHelper
  include MailerHelper
  include BasePrice::Recurrence

  def initialize(chargeable)
    @chargeable = chargeable
  end

  def can_manage_subscription?
    return false unless chargeable.is_a?(Purchase) && chargeable.link.is_recurring_billing?
    return false if chargeable.orderable.receipt_for_gift_receiver?
    return false if chargeable.is_a?(Purchase) && chargeable.is_gift_sender_purchase

    true
  end

  # Only called when can_manage_subscription? is true, so chargeable is a
  # Purchase on a membership product here.
  def manage_subscription_note
    # A membership that only ever charges once shouldn't promise a recurring
    # charge. Free-trial receipts keep the recurring wording because their one
    # charge hasn't happened yet.
    if chargeable.subscription.single_charge? && !chargeable.is_free_trial_purchase?
      I18n.t("mailers.customer.receipt.footer_single_charge_note", default: "You won't be charged again for this membership.")
    else
      I18n.t("mailers.customer.receipt.footer_recurring_note", recurrence: recurrence_long_indicator(chargeable.subscription.recurrence), default: "You'll be charged once %{recurrence}.")
    end
  end

  def manage_subscription_link
    link_to(I18n.t("subscriptions.manage_membership", default: "Manage membership"), manage_subscription_url)
  end

  def manage_subscription_url
    options = {
      host: UrlService.domain_with_protocol,
    }

    Rails.application.routes.url_helpers.manage_subscription_url(chargeable.subscription.external_id, options)
  end

  def unsubscribe_link
    purchase = chargeable

    if chargeable.is_a?(Charge) && chargeable.successful_purchases.any?
      purchase = chargeable.successful_purchases.last
    end

    link_to(
      I18n.t("mailers.common.unsubscribe", default: "Unsubscribe"),
      Rails.application.routes.url_helpers.unsubscribe_purchase_url(
        purchase.secure_external_id(scope: "unsubscribe"),
        host: UrlService.domain_with_protocol
      )
    )
  end

  private
    attr_reader :chargeable
end
