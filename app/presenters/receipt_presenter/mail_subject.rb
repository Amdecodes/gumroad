# frozen_string_literal: true

class ReceiptPresenter::MailSubject
  PRODUCT_NAME_CHARACTER_LIMIT = 27

  def self.build(chargeable)
    new(chargeable).build
  end

  def initialize(chargeable)
    @chargeable = chargeable
    @purchases = chargeable.unbundled_purchases
  end

  def build
    if purchases.one?
      build_for_one_purchase
    elsif purchases.count == 2
      build_for_two_purchases
    else
      build_for_more_than_two_purchases
    end
  end

  private
    attr_reader :chargeable, :purchases

    def build_for_one_purchase
      purchase = purchases.first
      name = purchase.link_name
      subject = I18n.t("mailers.customer.receipt.subject_bought", product: name)
      subject = I18n.t("mailers.customer.receipt.subject_got_free", product: name) if purchase.price_cents == 0
      subject = I18n.t("mailers.customer.receipt.subject_rented", product: name) if purchase.is_rental
      subject = I18n.t("mailers.customer.receipt.subject_subscribed", product: name) if purchase.link.is_recurring_billing
      subject = I18n.t("mailers.customer.receipt.subject_recurring_charge", product: name) if purchase.link.is_recurring_billing && purchase.is_recurring_subscription_charge
      subject = I18n.t("mailers.customer.receipt.subject_membership_upgraded", product: name) if purchase.link.is_recurring_billing && purchase.is_upgrade_purchase
      if purchase.is_gift_receiver_purchase
        subject = I18n.t("mailers.customer.receipt.subject_gift_named", gifter: purchase.gifter_email, product: name)
        subject = I18n.t("mailers.customer.receipt.subject_gift_named", gifter: "#{purchase.gifter_full_name} (#{purchase.gifter_email})", product: name) if purchase.gifter_full_name
        subject = I18n.t("mailers.customer.receipt.subject_gift_anonymous", product: name) if purchase.gifter_hidden_from_recipient?
      end
      subject = I18n.t("mailers.customer.receipt.subject_gift_sent", giftee: purchase.giftee_name_or_email, product: name) if purchase.is_gift_sender_purchase
      subject = I18n.t("mailers.customer.receipt.subject_commission_ready", product: purchase.link.name) if purchase.is_commission_completion_purchase?
      subject
    end

    def build_for_two_purchases
      first_name = purchases.first.link_name
      last_name = purchases.last.link_name

      return I18n.t("mailers.customer.receipt.subject_bought", product: first_name.truncate(PRODUCT_NAME_CHARACTER_LIMIT)) if first_name == last_name

      I18n.t("mailers.customer.receipt.subject_bought_two", first: first_name.truncate(PRODUCT_NAME_CHARACTER_LIMIT), second: last_name.truncate(PRODUCT_NAME_CHARACTER_LIMIT))
    end

    def build_for_more_than_two_purchases
      I18n.t("mailers.customer.receipt.subject_bought_multiple", first: purchases.first.link_name.truncate(PRODUCT_NAME_CHARACTER_LIMIT), count: purchases.count - 1)
    end
end
