# frozen_string_literal: true

class ReceiptPresenter::ChargeInfo
  include ActionView::Helpers::UrlHelper
  include CurrencyHelper
  include MailerHelper
  include ERB::Util
  include BuyerPresentmentDisplay

  def initialize(chargeable, for_email:, order_items_count:, presentment_currency: BuyerPresentmentDisplay::PRESENTMENT_CURRENCY_UNDECIDED)
    @for_email = for_email
    @order_items_count = order_items_count
    @chargeable = chargeable
    @seller = chargeable.seller
    @presentment_currency = presentment_currency
  end

  def formatted_created_at
    I18n.l(chargeable.orderable.created_at.to_date, format: :abbrev_month)
  end

  def formatted_total_transaction_amount
    if presentment_currency.present?
      StripeChargeProcessor.format_charge_presentment_amount(presentment_total_cents, presentment_currency)
    else
      formatted_dollar_amount(chargeable.charged_amount_cents)
    end
  end

  def order_id
    chargeable.external_id_for_invoice
  end

  def product_questions_note
    return if chargeable.orderable.receipt_for_gift_sender?

    question = I18n.t("mailers.customer.receipt.questions_about_product", count: order_items_count)

    action = \
      if for_email || chargeable.support_email.blank?
        I18n.t("mailers.customer.receipt.contact_seller_reply", seller: h(seller.display_name))
      else
        I18n.t("mailers.customer.receipt.contact_seller_at", seller: h(seller.display_name), email: mail_to(chargeable.support_email))
      end
    "#{question} #{action}".html_safe
  rescue NotImplementedError
    nil
  end

  private
    attr_reader :for_email, :order_items_count, :chargeable, :seller

    def presentment_currency
      presentment_currency_or_decide(chargeable.successful_purchases)
    end

    def presentment_total_cents
      @_presentment_total_cents ||= chargeable.successful_purchases.sum { _1.buyer_presentment_total_cents.to_i }
    end
end
