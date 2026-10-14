# frozen_string_literal: true

class CustomerMailerPreview < ActionMailer::Preview
  def grouped_receipt
    purchase_ids = Purchase.successful.order(id: :desc).limit(3).ids
    CustomerMailer.grouped_receipt(purchase_ids)
  end

  def giftee_receipt
    purchase = Gift.last&.giftee_purchase
    CustomerMailer.receipt(purchase&.id)
  end

  def giftee_subscription_receipt
    purchase = Purchase.where(purchase_state: :gift_receiver_purchase_successful).where.not(subscription_id: nil).last
    CustomerMailer.receipt(purchase&.id)
  end

  def giftee_shipping_receipt
    purchase = Purchase.where("purchase_state = ?", :gift_receiver_purchase_successful).where("city IS NOT NULL").first
    CustomerMailer.receipt(purchase&.id)
  end

  def gifter_receipt
    purchase = Gift.first&.gifter_purchase
    CustomerMailer.receipt(purchase&.id)
  end

  def gifter_subscription_receipt
    purchase = Purchase.successful.is_gift_sender_purchase.where.not(subscription_id: nil).last
    CustomerMailer.receipt(purchase&.id)
  end

  def physical_receipt
    CustomerMailer.receipt(Link.is_physical.last&.sales&.last&.id)
  end

  def physical_refund
    CustomerMailer.refund("sahil@gumroad.com", Link.is_physical.last&.id, Link.is_physical.last&.sales&.last&.id)
  end

  def preorder_receipt
    CustomerMailer.preorder_receipt(Preorder.find_by(state: "authorization_successful")&.id, Link.is_in_preorder_state.last&.id, "hi@gumroad.com")
  end

  def receipt
    purchase = Purchase.not_recurring_charge.not_is_gift_sender_purchase.last
    CustomerMailer.receipt(purchase&.id)
  end

  def receipt_custom
    purchase = Purchase.joins(:link).where("links.custom_receipt != ''").last
    CustomerMailer.receipt(purchase&.id)
  end

  def refund
    CustomerMailer.refund("sahil@gumroad.com", Link.last&.id, Purchase.last&.id)
  end

  # Refund email for a buyer-currency (presentment) purchase: the purchase total is shown
  # in the currency the buyer paid with, with the canonical USD total alongside.
  def refund_presentment
    purchase = Purchase.joins(:purchase_presentment).order(id: :desc).first
    CustomerMailer.refund("sahil@gumroad.com", purchase&.link_id, purchase&.id)
  end

  def partial_refund
    purchase = Purchase.last
    CustomerMailer.partial_refund("sahil@gumroad.com", purchase&.link_id, purchase&.id, (purchase&.total_transaction_cents.to_i / 2), "partially")
  end

  # Partial refund email for a buyer-currency (presentment) purchase. The USD amount is
  # the refund's gross total_transaction_cents (what production passes), not amount_cents,
  # so tax-inclusive refunds preview the same USD figure buyers see.
  def partial_refund_presentment
    refund = Refund.order(id: :desc).limit(500).detect(&:presentment_snapshot?)
    CustomerMailer.partial_refund("sahil@gumroad.com", refund&.link_id, refund&.purchase_id, refund&.total_transaction_cents, "partially", refund&.presentment_amount_cents, refund&.presentment_currency)
  end

  def receipt_subscription_original_charge
    CustomerMailer.receipt(Purchase.is_original_subscription_purchase.last&.id)
  end

  def receipt_subscription_recurring_charge
    CustomerMailer.receipt(Purchase.recurring_charge.last&.id)
  end

  def paypal_purchase_failed
    CustomerMailer.paypal_purchase_failed(Purchase.last&.id)
  end

  def subscription_magic_link
    @subscription = Subscription.last
    @subscription&.refresh_token
    CustomerMailer.subscription_magic_link(@subscription&.id, "test@gumroad.com")
  end

  def subscription_restarted
    CustomerMailer.subscription_restarted(Subscription.last&.id)
  end

  def subscription_restarted_for_payment_issue
    CustomerMailer.subscription_restarted(Subscription.last&.id, Subscription::ResubscriptionReason::PAYMENT_ISSUE_RESOLVED)
  end

  def abandoned_cart_preview
    CustomerMailer.abandoned_cart_preview(User.last&.id, Installment.alive.where(installment_type: Installment::ABANDONED_CART_TYPE).last&.id)
  end

  def abandoned_cart_single_workflow
    cart = Cart.abandoned.last
    workflow = Workflow.abandoned_cart_type.published.last
    CustomerMailer.abandoned_cart(cart&.id, { workflow&.id => workflow&.abandoned_cart_products(only_product_and_variant_ids: true).to_h.keys }.stringify_keys, true)
  end

  def abandoned_cart_multiple_workflows
    cart = Cart.abandoned.last
    workflows = Workflow.abandoned_cart_type.published.limit(2)
    workflow_ids_with_product_ids = workflows.to_h { |workflow| [workflow.id, workflow.abandoned_cart_products(only_product_and_variant_ids: true).to_h.keys] }.stringify_keys
    CustomerMailer.abandoned_cart(cart&.id, workflow_ids_with_product_ids, true)
  end

  def review_response
    CustomerMailer.review_response(ProductReviewResponse.last)
  end

  def upcoming_call_reminder
    CustomerMailer.upcoming_call_reminder(Call.last&.id)
  end

  def auto_invoice
    purchase = Purchase.successful.last
    CustomerMailer.auto_invoice(purchase&.id)
  end

  def files_ready_for_download
    purchase = Purchase.joins(:url_redirect).last
    CustomerMailer.files_ready_for_download(purchase&.id)
  end

  def grouped_receipt_am
    purchase_ids = Purchase.successful.order(id: :desc).limit(3).ids
    Purchase.where(id: purchase_ids).update_all(locale: "am")
    I18n.with_locale(:am) { CustomerMailer.grouped_receipt(purchase_ids) }
  end

  def giftee_receipt_am
    purchase = Gift.last&.giftee_purchase
    with_am_purchase(purchase) { CustomerMailer.receipt(purchase&.id) }
  end

  def giftee_subscription_receipt_am
    purchase = Purchase.where(purchase_state: :gift_receiver_purchase_successful).where.not(subscription_id: nil).last
    with_am_purchase(purchase) { CustomerMailer.receipt(purchase&.id) }
  end

  def giftee_shipping_receipt_am
    purchase = Purchase.where("purchase_state = ?", :gift_receiver_purchase_successful).where("city IS NOT NULL").first
    with_am_purchase(purchase) { CustomerMailer.receipt(purchase&.id) }
  end

  def gifter_receipt_am
    purchase = Gift.first&.gifter_purchase
    with_am_purchase(purchase) { CustomerMailer.receipt(purchase&.id) }
  end

  def gifter_subscription_receipt_am
    purchase = Purchase.successful.is_gift_sender_purchase.where.not(subscription_id: nil).last
    with_am_purchase(purchase) { CustomerMailer.receipt(purchase&.id) }
  end

  def physical_receipt_am
    purchase = Link.is_physical.last&.sales&.last
    with_am_purchase(purchase) { CustomerMailer.receipt(purchase&.id) }
  end

  def physical_refund_am
    purchase = Link.is_physical.last&.sales&.last
    with_am_purchase(purchase) { CustomerMailer.refund("sahil@gumroad.com", Link.is_physical.last&.id, purchase&.id) }
  end

  def preorder_receipt_am
    preorder = Preorder.find_by(state: "authorization_successful")
    preorder&.purchase&.update_column(:locale, "am")
    I18n.with_locale(:am) { CustomerMailer.preorder_receipt(preorder&.id, Link.is_in_preorder_state.last&.id, "hi@gumroad.com") }
  end

  def receipt_am
    purchase = Purchase.not_recurring_charge.not_is_gift_sender_purchase.last
    with_am_purchase(purchase) { CustomerMailer.receipt(purchase&.id) }
  end

  def receipt_custom_am
    purchase = Purchase.joins(:link).where("links.custom_receipt != ''").last
    with_am_purchase(purchase) { CustomerMailer.receipt(purchase&.id) }
  end

  def auto_invoice_am
    purchase = Purchase.successful.last
    with_am_purchase(purchase) { CustomerMailer.auto_invoice(purchase&.id) }
  end

  def refund_am
    purchase = Purchase.last
    with_am_purchase(purchase) { CustomerMailer.refund("sahil@gumroad.com", Link.last&.id, purchase&.id) }
  end

  def refund_presentment_am
    purchase = Purchase.joins(:purchase_presentment).order(id: :desc).first
    with_am_purchase(purchase) { CustomerMailer.refund("sahil@gumroad.com", purchase&.link_id, purchase&.id) }
  end

  def partial_refund_am
    purchase = Purchase.last
    with_am_purchase(purchase) { CustomerMailer.partial_refund("sahil@gumroad.com", purchase&.link_id, purchase&.id, (purchase&.total_transaction_cents.to_i / 2), "partially") }
  end

  def partial_refund_presentment_am
    refund = Refund.order(id: :desc).limit(500).detect(&:presentment_snapshot?)
    refund&.purchase&.update_column(:locale, "am")
    I18n.with_locale(:am) { CustomerMailer.partial_refund("sahil@gumroad.com", refund&.link_id, refund&.purchase_id, refund&.total_transaction_cents, "partially", refund&.presentment_amount_cents, refund&.presentment_currency) }
  end

  def receipt_subscription_original_charge_am
    purchase = Purchase.is_original_subscription_purchase.last
    with_am_purchase(purchase) { CustomerMailer.receipt(purchase&.id) }
  end

  def receipt_subscription_recurring_charge_am
    purchase = Purchase.recurring_charge.last
    with_am_purchase(purchase) { CustomerMailer.receipt(purchase&.id) }
  end

  def paypal_purchase_failed_am
    purchase = Purchase.last
    with_am_purchase(purchase) { CustomerMailer.paypal_purchase_failed(purchase&.id) }
  end

  def subscription_magic_link_am
    subscription = Subscription.last
    subscription&.refresh_token
    subscription&.original_purchase&.update_column(:locale, "am")
    I18n.with_locale(:am) { CustomerMailer.subscription_magic_link(subscription&.id, "test@gumroad.com") }
  end

  def subscription_restarted_am
    subscription = Subscription.last
    subscription&.original_purchase&.update_column(:locale, "am")
    I18n.with_locale(:am) { CustomerMailer.subscription_restarted(subscription&.id) }
  end

  def subscription_restarted_for_payment_issue_am
    subscription = Subscription.last
    subscription&.original_purchase&.update_column(:locale, "am")
    I18n.with_locale(:am) { CustomerMailer.subscription_restarted(subscription&.id, Subscription::ResubscriptionReason::PAYMENT_ISSUE_RESOLVED) }
  end

  def review_response_am
    response = ProductReviewResponse.last
    response&.product_review&.purchase&.update_column(:locale, "am")
    I18n.with_locale(:am) { CustomerMailer.review_response(response) }
  end

  def upcoming_call_reminder_am
    call = Call.last
    call&.purchase&.update_column(:locale, "am")
    I18n.with_locale(:am) { CustomerMailer.upcoming_call_reminder(call&.id) }
  end

  def files_ready_for_download_am
    purchase = Purchase.joins(:url_redirect).last
    with_am_purchase(purchase) { CustomerMailer.files_ready_for_download(purchase&.id) }
  end

  private
    def with_am_purchase(purchase, &block)
      purchase&.update_column(:locale, "am") if purchase&.persisted? && purchase&.locale != "am"
      I18n.with_locale(:am, &block)
    end
end
