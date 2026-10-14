# frozen_string_literal: true

class CustomerLowPriorityMailer < ApplicationMailer
  include CurrencyHelper
  helper PreorderHelper
  helper ProductsHelper
  include ActionView::Helpers::TextHelper
  default from: "Gumroad <noreply@#{CUSTOMERS_MAIL_DOMAIN}>"

  layout "layouts/email"

  def deposit(payment_id)
    @payment = Payment.find(payment_id)
    @user = @payment.user
    email = @user.form_email
    return unless EmailFormatValidator.valid?(email)

    @payment_currency = @payment.currency
    @payment_display_amount = @payment.displayed_amount
    @credit_amount_cents = @payment.credit_amount_cents.to_i
    @paid_date = @payment.payout_period_end_date.strftime("%B %e, %Y")

    payment_revenue_by_link = @payment.revenue_by_link

    previous_payout = @user.payments.completed.where("created_at < ?", @payment.created_at).order(:payout_period_end_date).last
    payout_start_date = previous_payout&.payout_period_end_date.try(:next)
    payout_end_date = @payment.payout_period_end_date
    paypal_revenue_by_product = @user.paypal_revenue_by_product_for_duration(start_date: payout_start_date, end_date: payout_end_date)
    stripe_connect_revenue_by_product = @user.stripe_connect_revenue_by_product_for_duration(start_date: payout_start_date, end_date: payout_end_date)

    @revenue_by_link = if payment_revenue_by_link.present? && paypal_revenue_by_product.present?
      payment_revenue_by_link.merge!(paypal_revenue_by_product) { |_link_id, payment_revenue, paypal_revenue| payment_revenue + paypal_revenue }
    elsif payment_revenue_by_link.present?
      payment_revenue_by_link
    elsif paypal_revenue_by_product.present?
      paypal_revenue_by_product
    else
      nil
    end

    if stripe_connect_revenue_by_product.present?
      @revenue_by_link = if @revenue_by_link
        @revenue_by_link.merge!(stripe_connect_revenue_by_product) { |_link_id, payment_revenue, stripe_connect_revenue| payment_revenue + stripe_connect_revenue }
      else
        stripe_connect_revenue_by_product
      end
    end

    @revenue_by_link = @revenue_by_link.sort_by { |_link_id, revenue_cents| revenue_cents.to_i }.reverse if @revenue_by_link

    paypal_sales_data = @user.paypal_sales_data_for_duration(start_date: payout_start_date, end_date: payout_end_date)
    @paypal_payout_amount_cents = @user.paypal_payout_net_cents(paypal_sales_data)
    stripe_connect_sales_data = @user.stripe_connect_sales_data_for_duration(start_date: payout_start_date, end_date: payout_end_date)
    @stripe_connect_payout_amount_cents = @user.stripe_connect_payout_net_cents(stripe_connect_sales_data)

    @affiliate_credit_cents = @user.affiliate_credit_cents_for_balances(@payment.balances.pluck(:id))

    mail(
      from: from_email_address_with_name(@user.name, "noreply@#{CUSTOMERS_MAIL_DOMAIN}"),
      to: email,
      subject: "It's pay day!",
      delivery_method_options: MailerInfo.random_delivery_method_options(domain: :customers, seller: @user, to: email)
    )
  end

  def subscription_autocancelled(subscription_id)
    @subscription = Subscription.find(subscription_id)
    with_recipient_locale(@subscription) do
      @subject =
        if @subscription.is_installment_plan?
          t("mailers.customer.subscription_autocancelled.installment_subject", default: "Your installment plan has been paused.")
        else
          t("mailers.customer.subscription_autocancelled.subscription_subject", default: "Your subscription has been canceled.")
        end
      deliver_subscription_email
    end
  end

  def subscription_cancelled(subscription_id)
    @subscription = Subscription.find(subscription_id)
    with_recipient_locale(@subscription) do
      @subject = t("mailers.customer.subscription_cancelled.subject", default: "Your subscription has been canceled.")
      deliver_subscription_email
    end
  end

  def subscription_cancelled_by_seller(subscription_id)
    @subscription = Subscription.find(subscription_id)
    with_recipient_locale(@subscription) do
      @subject =
        if @subscription.is_installment_plan?
          t("mailers.customer.subscription_cancelled_by_seller.installment_subject", default: "Your installment plan has been canceled.")
        else
          t("mailers.customer.subscription_cancelled_by_seller.subscription_subject", default: "Your subscription has been canceled.")
        end
      deliver_subscription_email
    end
  end

  def subscription_card_declined(subscription_id)
    @subscription = Subscription.find(subscription_id)
    with_recipient_locale(@subscription) do
      @declined = true
      @payment_method_is_upi = @subscription.credit_card_to_charge&.recurring_upi?
      @subject = @payment_method_is_upi ? t("mailers.customer.subscription_card_declined.upi_subject", default: "Your payment method needs attention.") : t("mailers.customer.subscription_card_declined.card_subject", default: "Your card was declined.")
      deliver_subscription_email
    end
  end

  def subscription_card_declined_warning(subscription_id)
    @subscription = Subscription.find(subscription_id)
    with_recipient_locale(@subscription) do
      @declined = true
      @payment_method_is_upi = @subscription.credit_card_to_charge&.recurring_upi?
      @subject = @payment_method_is_upi ? t("mailers.customer.subscription_card_declined_warning.upi_subject", default: "Your payment method needs attention.") : t("mailers.customer.subscription_card_declined_warning.card_subject", default: "Your card was declined.")
      deliver_subscription_email
    end
  end

  def subscription_indian_card_mandate_invalid(subscription_id)
    @subscription = Subscription.find(subscription_id)
    with_recipient_locale(@subscription) do
      @subject = t("mailers.customer.subscription_indian_card_mandate_invalid.subject", default: "Update your payment method to keep automatic renewals active.")
      deliver_subscription_email
    end
  end

  def subscription_charge_failed(subscription_id)
    @subscription = Subscription.find(subscription_id)
    with_recipient_locale(@subscription) do
      @subject =
        if @subscription.is_installment_plan?
          t("mailers.customer.subscription_charge_failed.installment_subject", default: "Your installment payment failed.")
        else
          t("mailers.customer.subscription_charge_failed.subscription_subject", default: "Your recurring charge failed.")
        end
      deliver_subscription_email
    end
  end

  def subscription_charge_blocked_location(subscription_id)
    @subscription = Subscription.find(subscription_id)
    with_recipient_locale(@subscription) do
      @declined = true
      @subject =
        if @subscription.is_installment_plan?
          t("mailers.customer.subscription_charge_blocked_location.installment_subject", default: "Your installment payment could not be processed.")
        else
          t("mailers.customer.subscription_charge_blocked_location.subscription_subject", default: "Your membership could not be renewed.")
        end
      deliver_subscription_email
    end
  end

  def subscription_product_deleted(subscription_id)
    @subscription = Subscription.find(subscription_id)
    with_recipient_locale(@subscription) do
      @subject =
        if @subscription.is_installment_plan?
          t("mailers.customer.subscription_product_deleted.installment_subject", default: "Your installment plan has been canceled.")
        else
          t("mailers.customer.subscription_product_deleted.subscription_subject", default: "Your subscription has been canceled.")
        end
      deliver_subscription_email
    end
  end

  def subscription_ended(subscription_id)
    @subscription = Subscription.find(subscription_id)
    with_recipient_locale(@subscription) do
      @subject =
        if @subscription.is_installment_plan?
          t("mailers.customer.subscription_ended.installment_subject", default: "Your installment plan has been paid in full.")
        else
          t("mailers.customer.subscription_ended.subscription_subject", default: "Your subscription has ended.")
        end
      deliver_subscription_email
    end
  end

  def subscription_renewal_reminder(subscription_id)
    @subscription = Subscription.find(subscription_id)
    with_recipient_locale(@subscription) do
      @subject =
        if @subscription.is_installment_plan?
          t("mailers.subscription_renewal_reminder.installment_subject", default: "Upcoming installment payment reminder")
        else
          t("mailers.subscription_renewal_reminder.membership_subject", default: "Upcoming automatic membership renewal")
        end
      @date = I18n.l(@subscription.end_time_of_subscription.to_date, format: :full_month)
      original_purchase = @subscription.original_purchase
      @price = original_purchase.format_price_in_currency(@subscription.current_subscription_price_cents)
      @edit_card_url = manage_subscription_url(@subscription.external_id, token: @subscription.token)
      @delivery_options = { reply_to: @subscription.seller.support_or_form_email }
      deliver_subscription_email
    end
  end

  def subscription_price_change_notification(subscription_id:, email: nil, new_price:)
    @subscription = Subscription.find(subscription_id)
    with_recipient_locale(@subscription) do
      @email = email
      @subject = t("mailers.customer.subscription_price_change_notification.subject", default: "Important changes to your membership")
      effective_date = @subscription.tier.subscription_price_change_effective_date
      @effective_date = I18n.l(effective_date, format: :full_month)
      @product = @subscription.link
      @message = @subscription.tier.subscription_price_change_message ||
        if effective_date < Time.current.to_date
          t("mailers.customer.subscription_price_change_notification.message_past_html", product: @product.name, date: @effective_date)
        else
          t("mailers.customer.subscription_price_change_notification.message_future_html", product: @product.name, date: @effective_date)
        end
      @next_payment_date = I18n.l(@subscription.end_time_of_subscription.to_date, format: :full_month)
      original_purchase = @subscription.original_purchase
      @previous_price = original_purchase.format_price_in_currency(original_purchase.displayed_price_cents)
      @new_price = original_purchase.format_price_in_currency(new_price)
      if original_purchase.has_tax_label?
        tax_suffix = " " + t("mailers.customer.subscription_price_change_notification.plus_taxes", default: "(plus taxes)")
        @previous_price += tax_suffix
        @new_price += tax_suffix
      end
      @payment_method = original_purchase.card_type.present? && original_purchase.card_visual.present? ? "#{original_purchase.card_type.upcase} *#{original_purchase.card_visual.delete("*").delete(" ")}" : nil
      @seller_name = original_purchase.seller.display_name
      @delivery_options = { reply_to: @subscription.seller.support_or_form_email }
      deliver_subscription_email
    end
  end

  def sample_subscription_price_change_notification(user:, tier:, effective_date:, recurrence:, new_price:, custom_message: nil)
    @effective_date = effective_date.strftime("%B %e, %Y")
    @product = tier.link
    @message = custom_message || tier.subscription_price_change_message ||
      "The price of your membership to \"#{@product.name}\" " +
        (effective_date < Time.current.to_date ?
           "changed on #{@effective_date}.<br /><br />You will be charged the new price starting with your next billing period." :
           "is changing on #{@effective_date}.<br /><br />"
        ) + "You can modify or cancel your membership at any time."
    @next_payment_date = (effective_date + 4.days).to_date.strftime("%B %e, %Y")
    charge_occurrence_count = tier.link.duration_in_months.present? ? tier.link.duration_in_months / BasePrice::Recurrence.number_of_months_in_recurrence(recurrence) : nil
    @previous_price = formatted_price_in_currency_with_recurrence(new_price * 0.8, tier.link.price_currency_type, recurrence, charge_occurrence_count)
    @new_price = formatted_price_in_currency_with_recurrence(new_price, tier.link.price_currency_type, recurrence, charge_occurrence_count)
    @payment_method = "VISA *1234"
    seller = tier.link.user
    @seller_name = seller.display_name
    @edit_card_url = "#"

    mail to: user.email,
         subject: "Important changes to your membership",
         delivery_method_options: MailerInfo.random_delivery_method_options(domain: :customers, seller:, to: user.email),
         reply_to: seller.support_or_form_email,
         template_name: "subscription_price_change_notification"
  end

  def subscription_early_fraud_warning_notification(purchase_id)
    @purchase = Purchase.find(purchase_id)
    @subscription = @purchase.subscription
    with_recipient_locale(@subscription || @purchase) do
      @product = @subscription.link
      @price = @subscription.original_purchase.formatted_total_price
      @purchase_date = I18n.l(@purchase.created_at.to_date, format: :abbrev_month)

      @subject = t("mailers.customer.subscription_early_fraud_warning_notification.subject", default: "Regarding your recent purchase reported as fraud")
      @delivery_options = { reply_to: @subscription.seller.support_or_form_email }
      deliver_subscription_email
    end
  end

  def subscription_giftee_added_card(subscription_id)
    @subscription = Subscription.find(subscription_id)
    credit_card = @subscription.credit_card
    return if credit_card.nil?

    with_recipient_locale(@subscription) do
      chargeable = @subscription.purchases.is_gift_receiver_purchase.first
      original_purchase = @subscription.original_purchase
      card_visual = "#{credit_card.card_type.upcase} *#{credit_card.visual.delete("*").delete(" ")}"

      @receipt_presenter = ReceiptPresenter.new(chargeable, for_email: true)
      @attributes = [
        { label: "Membership", value: original_purchase.formatted_total_price },
        { label: "First payment", value: @subscription.formatted_end_time_of_subscription },
        { label: "Payment method", value: card_visual }
      ]

      @subject = t("mailers.customer.subscription_giftee_added_card.subject", product: @subscription.link.name, default: "Your gift membership for #{@subscription.link.name} has been updated")
      @delivery_options = { reply_to: @subscription.seller.support_or_form_email }
      deliver_subscription_email
    end
  end

  def rental_expiring_soon(purchase_id, time_till_rental_expiration_in_seconds)
    purchase = Purchase.find(purchase_id)
    return unless EmailFormatValidator.valid?(purchase.email)

    with_recipient_locale(purchase) do
      url_redirect = purchase.url_redirect
      expires_in = if time_till_rental_expiration_in_seconds > 1.day
        pluralize(time_till_rental_expiration_in_seconds / 1.day, "day")
      else
        pluralize(time_till_rental_expiration_in_seconds / 1.hour, "hour")
      end

      @subject = t("mailers.customer.rental_expiring_soon.subject", time: expires_in, default: "Your rental will expire in #{expires_in}")
      @content = "<p>Hey there,</p><p>Your rental of #{purchase.link.name} will expire in #{expires_in}. After that, you'll have to rent the title again to watch it. Don't miss out!</p>".html_safe
      @watch_url = url_redirect.download_page_url

      mail(
        to: purchase.email,
        reply_to: "noreply@#{CUSTOMERS_MAIL_DOMAIN}",
        subject: @subject,
        delivery_method_options: MailerInfo.random_delivery_method_options(domain: :customers, seller: purchase.seller, to: purchase.email)
      )
    end
  end

  def preorder_card_declined(preorder_id)
    @preorder = Preorder.find_by(id: preorder_id)
    @preorder_link = @preorder.preorder_link
    @product = @preorder_link.link
    authorization_purchase = @preorder.authorization_purchase
    return unless EmailFormatValidator.valid?(authorization_purchase.email)

    with_recipient_locale(authorization_purchase) do
      mail(
        to: authorization_purchase.email,
        from: "Gumroad <noreply@#{CUSTOMERS_MAIL_DOMAIN}>",
        reply_to: [@product.user.email, "Gumroad <noreply@#{CUSTOMERS_MAIL_DOMAIN}>"],
        subject: t("mailers.customer.preorder_card_declined.subject", product: @product.name, default: "Could not charge your credit card for #{@product.name}"),
        delivery_method_options: MailerInfo.random_delivery_method_options(domain: :customers, seller: @product.user, to: authorization_purchase.email)
      )
    end
  end

  def preorder_cancelled(preorder_id)
    @preorder = Preorder.find_by(id: preorder_id)
    authorization_purchase = @preorder.authorization_purchase
    return unless EmailFormatValidator.valid?(authorization_purchase.email)

    with_recipient_locale(authorization_purchase) do
      mail(
        to: authorization_purchase.email,
        subject: t("mailers.customer.preorder_cancelled.subject", default: "Your pre-order has been canceled."),
        delivery_method_options: MailerInfo.random_delivery_method_options(domain: :customers, seller: @preorder.preorder_link.link.user, to: authorization_purchase.email)
      )
    end
  end

  def order_shipped(shipment_id)
    @shipment = Shipment.find(shipment_id)
    purchase = @shipment.purchase
    return unless EmailFormatValidator.valid?(purchase.email)

    @product = purchase.link
    @tracking_link = @shipment.tracking_link_for_display
    with_recipient_locale(purchase) do
      mail(
        to: purchase.email,
        reply_to: @product.user.support_or_form_email,
        subject: t("mailers.customer.order_shipped.subject", default: "Your order has shipped!"),
        delivery_method_options: MailerInfo.random_delivery_method_options(domain: :customers, seller: @product.user, to: purchase.email)
      )
    end
  end

  # Sent after Risk::StrandedBuyerRecoveryService clears the blocks that were failing this buyer's
  # checkouts, so they know retrying is worth their time. Deliberately vague about the mechanism:
  # naming the systems involved helps nobody and reads as an accusation.
  def blocked_purchase_resolved(purchase_id)
    @purchase = Purchase.find(purchase_id)
    return unless EmailFormatValidator.valid?(@purchase.email)

    @product = @purchase.link

    with_recipient_locale(@purchase) do
      mail(
        to: @purchase.email,
        subject: t("mailers.customer.blocked_purchase_resolved.subject", default: "Your payment issue has been resolved"),
        delivery_method_options: MailerInfo.random_delivery_method_options(domain: :customers, seller: @product&.user, to: @purchase.email)
      )
    end
  end

  def chargeback_notice_to_customer(dispute_id)
    dispute = Dispute.find(dispute_id)
    @disputable = dispute.disputable

    with_recipient_locale(@disputable.purchase_for_dispute_evidence) do
      mail(
        to: @disputable.purchase_for_dispute_evidence.email,
        subject: t("mailers.customer.chargeback_notice_to_customer.subject", default: "Regarding your recent dispute."),
        delivery_method_options: MailerInfo.random_delivery_method_options(domain: :customers, seller: @disputable.purchase_for_dispute_evidence.seller, to: @disputable.purchase_for_dispute_evidence.email)
      )
    end
  end

  # Specific email that is sent in case this credit card is tied to a membership.
  # @param subscription_id [Integer]
  def credit_card_expiring_membership(subscription_id)
    @subscription = Subscription.find(subscription_id)
    with_recipient_locale(@subscription) do
      credit_card = @subscription.credit_card
      @last_4_digits_of_credit_card = credit_card.last_four_digits
      @expiry_month_name = I18n.t("date.month_names")[credit_card.expiry_month]
      @product = @subscription.link
      @subject = t("mailers.customer.credit_card_expiring_membership.subject", product: @product.name, default: "Payment method for #{@product.name} is about to expire")
      deliver_subscription_email
    end
  end

  def free_trial_expiring_soon(subscription_id)
    @subscription = Subscription.find(subscription_id)
    with_recipient_locale(@subscription) do
      @subject = t("mailers.customer.free_trial_expiring_soon.subject", default: "Your free trial is ending soon")
      deliver_subscription_email
    end
  end

  def bundle_content_updated(purchase_id)
    @purchase = Purchase.find(purchase_id)

    @product_name = @purchase.link.name
    @seller_name = @purchase.seller.name_or_username
    with_recipient_locale(@purchase) do
      @title = t("mailers.customer.bundle_content_updated.subject", seller: @seller_name, product: @product_name, default: "#{@seller_name} just added content to #{@product_name}")
      mail(
        to: @purchase.email,
        subject: @title,
        delivery_method_options: MailerInfo.random_delivery_method_options(domain: :customers, seller: @purchase.seller, to: @purchase.email)
      )
    end
  end

  def purchase_review_reminder(purchase_id)
    @purchase = Purchase.find(purchase_id)
    return if @purchase.product_review.present? || !@purchase.can_contact? || @purchase.purchaser&.opted_out_of_review_reminders?

    @product_name = @purchase.link.name
    @unsub_link = review_reminder_unsubscribe_url(@purchase.purchaser, @purchase.email, purchase: @purchase)
    @purchaser_name = @purchase.full_name.presence || @purchase.purchaser&.name&.presence

    # For a bundle, the reminder is about reviewing the bundle itself. The bundle's
    # download page can't be used here because it redirects to the library, which has
    # no review UI. Link every bundle buyer (account-backed or guest) to the bundle's
    # product page with the purchase's external id and email digest appended: the page
    # verifies the digest server-side and shows the review form directly, so the link
    # works in any browser without a session and without a login wall.
    @review_url = if @purchase.is_bundle_purchase?
      "#{@purchase.link.long_url}?#{{ purchase_id: @purchase.external_id, purchase_email_digest: @purchase.email_digest }.to_query}"
    else
      @purchase.url_redirect&.download_page_url || @purchase.link.long_url
    end

    with_recipient_locale(@purchase) do
      @title = t("mailers.customer.purchase_review_reminder.subject", product: @product_name, default: "Liked #{@product_name}? Give it a review!")
      mail(
        to: @purchase.email,
        subject: @title,
        delivery_method_options: MailerInfo.random_delivery_method_options(domain: :customers, seller: @purchase.seller, to: @purchase.email)
      )
    end
  end

  def order_review_reminder(order_id)
    order = Order.find(order_id)
    purchaser = order.purchaser
    return if purchaser&.opted_out_of_review_reminders?

    # Re-checked at render time: the :low queue can lag behind a buyer unsubscribing, and for
    # a guest the purchaser opt-out above is always nil. No purchase_for_review_reminder
    # mapping — gift orders never reach this mailer (OrderReviewReminderJob routes them
    # per-purchase).
    reviewable = order.purchases.select { _1.eligible_for_review_reminder? }
    return if reviewable.empty?

    # Every recipient-shaped value comes from this one row. `order.purchases.first` can be a
    # purchase the reminder excludes, and its email can differ from the eligible rows' (support
    # reassignment rewrites a single purchase's email), so reading the address from it would mail
    # a buyer this reminder is not about while the unsubscribe link cleared someone else's row.
    # Orders whose eligible purchases no longer share one address are split per-purchase upstream.
    recipient_purchase = reviewable.first

    @purchaser_name = recipient_purchase.full_name.presence || purchaser&.name&.presence
    @review_url = reviews_url
    email = purchaser&.email || recipient_purchase.email
    @unsub_link = review_reminder_unsubscribe_url(purchaser, email, purchase: recipient_purchase)

    with_recipient_locale(recipient_purchase) do
      @title = t("mailers.customer.order_review_reminder.subject", default: "Liked your order? Leave some reviews!")
      mail(
        to: email,
        subject: @title,
        delivery_method_options: MailerInfo.random_delivery_method_options(domain: :customers, seller: recipient_purchase.seller, to: email)
      )
    end
  end

  def wishlist_updated(wishlist_follower_id, product_count)
    @wishlist_follower = WishlistFollower.find(wishlist_follower_id)
    return if @wishlist_follower.deleted?

    @footer_template = "customer_low_priority_mailer/wishlist_updated_footer"
    @wishlist_url = wishlist_url(@wishlist_follower.wishlist.url_slug, host: @wishlist_follower.wishlist.user.subdomain_with_protocol)
    @thumbnail_products = @wishlist_follower.wishlist.wishlist_products.alive.order(created_at: :desc).first(4).map(&:product)

    with_recipient_locale(@wishlist_follower.follower_user) do
      @title = product_count == 1 ?
        t("mailers.customer.wishlist_updated.subject_single", user: @wishlist_follower.wishlist.user.name_or_username, default: "#{@wishlist_follower.wishlist.user.name_or_username} recently added a new product to their wishlist!") :
        t("mailers.customer.wishlist_updated.subject_multiple", user: @wishlist_follower.wishlist.user.name_or_username, count: product_count, default: "#{@wishlist_follower.wishlist.user.name_or_username} recently added #{product_count} new products to their wishlist!")
      mail(
        to: @wishlist_follower.follower_user.email,
        subject: @title,
        delivery_method_options: MailerInfo.random_delivery_method_options(domain: :customers, seller: @wishlist_follower.wishlist.user, to: @wishlist_follower.follower_user.email)
      )
    end
  end

  def already_subscribed_checkout_attempt(subscription_id)
    @subscription = Subscription.find(subscription_id)
    @product = @subscription.link
    # The checkout error shown to the logged-out visitor promises that this email
    # contains a link to manage the subscription, so include a tokenized magic
    # link. `reusable_token` keeps the existing token when it is still valid and
    # only mints a new one when it is missing or expired — repeated duplicate
    # checkout attempts can queue several of these emails, and rotating the
    # token on every delivery would invalidate the links in earlier emails.
    @manage_url = manage_subscription_url(@subscription.external_id, token: @subscription.reusable_token)

    with_recipient_locale(@subscription) do
      mail(
        to: @subscription.email,
        subject: t("mailers.customer.already_subscribed_checkout_attempt.subject", default: "Someone tried to purchase a membership you already have"),
        delivery_method_options: MailerInfo.random_delivery_method_options(domain: :customers, seller: @subscription.seller, to: @subscription.email)
      )
    end
  end

  private
    # The token is a sessionless capability over the purchaser account's preference, so it may
    # only travel to that account's own address. A purchase can be claimed into a different
    # account (Users#add_purchase_to_library, UrlRedirects, support reassignment) while
    # `purchase.email` keeps pointing at whoever bought it, and that recipient must not be
    # handed the new owner's opt-out. When the two diverge, fall back to the session-gated
    # route: the link still works, it just makes the visitor prove who they are first.
    #
    # Guests have no User row to hold the preference at all, so they get the receipt footer's
    # purchase-scoped unsubscribe: broader (it clears `can_contact` for that purchase's seller,
    # and on a multi-seller order only that one) but sessionless and honoured by
    # `eligible_for_review_reminder?`.
    def review_reminder_unsubscribe_url(purchaser, recipient_email, purchase:)
      if purchaser.nil?
        return if purchase.nil?

        return unsubscribe_purchase_url(purchase.secure_external_id(scope: "unsubscribe"))
      end

      if purchaser.email.present? && recipient_email.present? && purchaser.email.casecmp?(recipient_email)
        user_unsubscribe_review_reminders_by_token_url(
          purchaser.secure_external_id(scope: Users::ReviewRemindersController::TOKEN_SCOPE)
        )
      else
        user_unsubscribe_review_reminders_url
      end
    end

    def deliver_subscription_email
      if @subject.nil?
        Rails.logger.warn("[CustomerLowPriorityMailer] Skipping subscription email delivery because @subject is nil; action=#{action_name}; subscription_id=#{@subscription&.id}")
        return
      end

      query_params = { token: @subscription.refresh_token }
      query_params[:declined] = true if @declined
      @edit_card_url = manage_subscription_url(@subscription.external_id, query_params)
      options = {
        to: @subscription.email,
        subject: @subject,
        delivery_method_options: MailerInfo.random_delivery_method_options(domain: :customers, seller: @subscription.original_purchase.seller, to: @subscription.email)
      }.merge(@delivery_options || {})

      mail options
    end
end
