# frozen_string_literal: true

require "spec_helper"

describe "All buyer mailers render cleanly in Amharic" do
  let(:seller) { create(:named_seller, name: "Abebe Seller") }
  let(:product) { create(:product, user: seller, name: "Sample Book") }
  let(:user) { create(:user, email: "buyer@example.com", locale: "am") }
  let(:purchase) do
    create(
      :purchase,
      link: product,
      seller:,
      purchaser: user,
      email: "buyer@example.com",
      locale: "am"
    ).tap(&:create_url_redirect!)
  end
  let(:membership_purchase) do
    create(
      :membership_purchase,
      price_cents: 500,
      purchaser: user,
      email: "buyer@example.com",
      locale: "am"
    ).tap(&:create_url_redirect!)
  end
  let(:subscription) { membership_purchase.subscription }

  def verify_mail_rendering(mail)
    expect(mail).to be_present
    expect(mail.parts.length).to be >= 2

    html_part = mail.html_part&.body&.decoded&.force_encoding("UTF-8")
    text_part = mail.text_part&.body&.decoded&.force_encoding("UTF-8")

    expect(html_part).to be_present
    expect(html_part).not_to include("translation missing")
    expect(html_part).not_to include("translation_missing")
    expect(html_part).not_to include("<span class=\"translation_missing\"")

    expect(text_part).to be_present
    expect(text_part).not_to include("translation missing")
    expect(text_part).not_to include("translation_missing")
  end

  describe "CustomerMailer" do
    it "renders receipt without missing translations" do
      mail = CustomerMailer.receipt(purchase.id)
      verify_mail_rendering(mail)
    end

    it "renders refund without missing translations" do
      mail = CustomerMailer.refund(purchase.email, product.id, purchase.id)
      verify_mail_rendering(mail)
    end

    it "renders partial_refund without missing translations" do
      mail = CustomerMailer.partial_refund(purchase.email, product.id, purchase.id, 500, "partially")
      verify_mail_rendering(mail)
    end

    it "renders auto_invoice without missing translations" do
      allow(AutoInvoiceEligibility).to receive(:eligible?).and_return(true)
      allow_any_instance_of(InvoicePdfGenerator).to receive(:call).and_return("DUMMY PDF DATA")
      mail = CustomerMailer.auto_invoice(purchase.id)
      verify_mail_rendering(mail)
    end

    it "renders files_ready_for_download without missing translations" do
      mail = CustomerMailer.files_ready_for_download(purchase.id)
      verify_mail_rendering(mail)
    end

    it "renders paypal_purchase_failed without missing translations" do
      mail = CustomerMailer.paypal_purchase_failed(purchase.id)
      verify_mail_rendering(mail)
    end

    it "renders subscription_magic_link without missing translations" do
      subscription.refresh_token
      mail = CustomerMailer.subscription_magic_link(subscription.id, "buyer@example.com")
      verify_mail_rendering(mail)
    end

    it "renders subscription_restarted without missing translations" do
      membership_purchase # ensure original purchase exists with locale: am
      mail = CustomerMailer.subscription_restarted(subscription.id)
      verify_mail_rendering(mail)
    end

    it "renders grouped_receipt without missing translations" do
      mail = CustomerMailer.grouped_receipt([purchase.id])
      verify_mail_rendering(mail)
    end

    it "renders preorder_receipt without missing translations" do
      preorder_link = create(:preorder_link, link: product, release_at: 2.days.from_now)
      preorder = preorder_link.build_preorder(
        create(:preorder_authorization_purchase, link: product, seller:, email: "buyer@example.com", locale: "am")
      )
      preorder.save!
      mail = CustomerMailer.preorder_receipt(preorder.id, product.id, "buyer@example.com")
      verify_mail_rendering(mail)
    end
  end

  describe "CustomerLowPriorityMailer" do
    before do
      membership_purchase # ensure original purchase exists with locale: am
      fake_card = double(
        "CreditCard",
        last_four_digits: "4242",
        expiration_date: 1.month.from_now,
        recurring_upi?: false,
        expiry_month: 12
      )
      allow_any_instance_of(Subscription).to receive(:credit_card).and_return(fake_card)
      allow_any_instance_of(Subscription).to receive(:credit_card_to_charge).and_return(fake_card)
    end

    it "renders blocked_purchase_resolved without missing translations" do
      mail = CustomerLowPriorityMailer.blocked_purchase_resolved(purchase.id)
      verify_mail_rendering(mail)
    end

    it "renders subscription_autocancelled without missing translations" do
      mail = CustomerLowPriorityMailer.subscription_autocancelled(subscription.id)
      verify_mail_rendering(mail)
    end

    it "renders subscription_cancelled without missing translations" do
      mail = CustomerLowPriorityMailer.subscription_cancelled(subscription.id)
      verify_mail_rendering(mail)
    end

    it "renders subscription_cancelled_by_seller without missing translations" do
      mail = CustomerLowPriorityMailer.subscription_cancelled_by_seller(subscription.id)
      verify_mail_rendering(mail)
    end

    it "renders subscription_ended without missing translations" do
      mail = CustomerLowPriorityMailer.subscription_ended(subscription.id)
      verify_mail_rendering(mail)
    end

    it "renders subscription_card_declined without missing translations" do
      mail = CustomerLowPriorityMailer.subscription_card_declined(subscription.id)
      verify_mail_rendering(mail)
    end

    it "renders subscription_card_declined_warning without missing translations" do
      mail = CustomerLowPriorityMailer.subscription_card_declined_warning(subscription.id)
      verify_mail_rendering(mail)
    end

    it "renders subscription_charge_failed without missing translations" do
      mail = CustomerLowPriorityMailer.subscription_charge_failed(subscription.id)
      verify_mail_rendering(mail)
    end

    it "renders subscription_product_deleted without missing translations" do
      mail = CustomerLowPriorityMailer.subscription_product_deleted(subscription.id)
      verify_mail_rendering(mail)
    end

    it "renders subscription_renewal_reminder without missing translations" do
      allow_any_instance_of(Subscription).to receive(:end_time_of_subscription).and_return(1.month.from_now)
      mail = CustomerLowPriorityMailer.subscription_renewal_reminder(subscription.id)
      verify_mail_rendering(mail)
    end

    it "renders subscription_price_change_notification without missing translations" do
      tier = membership_purchase.tier
      tier.update!(
        apply_price_changes_to_existing_memberships: true,
        subscription_price_change_effective_date: 1.month.from_now.to_date
      )
      mail = CustomerLowPriorityMailer.subscription_price_change_notification(
        subscription_id: subscription.id,
        new_price: 1500
      )
      verify_mail_rendering(mail)
    end

    it "renders credit_card_expiring_membership without missing translations" do
      mail = CustomerLowPriorityMailer.credit_card_expiring_membership(subscription.id)
      verify_mail_rendering(mail)
    end

    it "renders free_trial_expiring_soon without missing translations" do
      subscription.update!(free_trial_ends_at: 3.days.from_now)
      mail = CustomerLowPriorityMailer.free_trial_expiring_soon(subscription.id)
      verify_mail_rendering(mail)
    end

    it "renders chargeback_notice_to_customer without missing translations" do
      dispute = create(:dispute_formalized, purchase:)
      mail = CustomerLowPriorityMailer.chargeback_notice_to_customer(dispute.id)
      verify_mail_rendering(mail)
    end

    it "renders purchase_review_reminder without missing translations" do
      mail = CustomerLowPriorityMailer.purchase_review_reminder(purchase.id)
      verify_mail_rendering(mail)
    end
  end

  describe "UserSignupMailer and TwoFactorAuthenticationMailer" do
    it "renders confirmation_instructions without missing translations" do
      mail = UserSignupMailer.confirmation_instructions(user, "fake-token")
      verify_mail_rendering(mail)
    end

    it "renders reset_password_instructions without missing translations" do
      mail = UserSignupMailer.reset_password_instructions(user, "fake-token")
      verify_mail_rendering(mail)
    end

    it "renders email_changed without missing translations" do
      mail = UserSignupMailer.email_changed(user)
      verify_mail_rendering(mail)
    end

    it "renders password_change without missing translations" do
      mail = UserSignupMailer.password_change(user)
      verify_mail_rendering(mail)
    end

    it "renders unlock_instructions without missing translations" do
      mail = UserSignupMailer.unlock_instructions(user, "fake-token")
      verify_mail_rendering(mail)
    end

    it "renders authentication_token without missing translations" do
      mail = TwoFactorAuthenticationMailer.authentication_token(user.id)
      verify_mail_rendering(mail)
    end
  end
end
