# frozen_string_literal: true

require "spec_helper"

describe "All buyer and seller mailers render ETB currency without $ or USD" do
  let(:seller) { create(:user, name: "Almaz Kebede") }
  let(:product) { create(:product, user: seller, name: "Amharic Poetry Collection", price_cents: 25_000) }
  let(:buyer) { create(:user) }
  let(:purchase) do
    create(
      :purchase,
      link: product,
      seller:,
      purchaser: buyer,
      email: buyer.email,
      price_cents: 25_000,
      displayed_price_currency_type: "etb",
      charge_processor_id: "chapa"
    ).tap(&:create_url_redirect!)
  end

  let(:membership_product) do
    create(:membership_product, user: seller, name: "Monthly Art Club", price_cents: 10_000)
  end
  let(:membership_purchase) do
    create(
      :membership_purchase,
      link: membership_product,
      seller:,
      purchaser: buyer,
      email: buyer.email,
      price_cents: 10_000,
      displayed_price_currency_type: "etb",
      charge_processor_id: "chapa"
    ).tap(&:create_url_redirect!)
  end
  let(:subscription) { membership_purchase.subscription }

  def verify_no_usd_or_dollar_sign(mail)
    expect(mail).to be_present
    subject = mail.subject.to_s
    expect(subject).not_to include("$")
    expect(subject).not_to include("USD")

    if mail.multipart?
      html_part = mail.html_part&.body&.decoded&.force_encoding("UTF-8")
      text_part = mail.text_part&.body&.decoded&.force_encoding("UTF-8")
      if html_part
        expect(html_part).not_to include("$")
        expect(html_part).not_to include("USD")
      end
      if text_part
        expect(text_part).not_to include("$")
        expect(text_part).not_to include("USD")
      end
    else
      body = mail.body.decoded.force_encoding("UTF-8")
      expect(body).not_to include("$")
      expect(body).not_to include("USD")
    end
  end

  describe "CustomerMailer" do
    it "renders receipt with ETB currency and no $ or USD" do
      mail = CustomerMailer.receipt(purchase.id)
      verify_no_usd_or_dollar_sign(mail)
    end

    it "renders refund with ETB currency and no $ or USD" do
      mail = CustomerMailer.refund(purchase.email, product.id, purchase.id)
      verify_no_usd_or_dollar_sign(mail)
    end

    it "renders partial_refund with ETB currency and no $ or USD" do
      mail = CustomerMailer.partial_refund(purchase.email, product.id, purchase.id, 5_000, "partially")
      verify_no_usd_or_dollar_sign(mail)
    end

    it "renders auto_invoice with ETB currency and no $ or USD" do
      allow(AutoInvoiceEligibility).to receive(:eligible?).and_return(true)
      allow_any_instance_of(InvoicePdfGenerator).to receive(:call).and_return("DUMMY PDF DATA")
      mail = CustomerMailer.auto_invoice(purchase.id)
      verify_no_usd_or_dollar_sign(mail)
    end

    it "renders files_ready_for_download without $ or USD" do
      mail = CustomerMailer.files_ready_for_download(purchase.id)
      verify_no_usd_or_dollar_sign(mail)
    end

    it "renders grouped_receipt with ETB currency and no $ or USD" do
      mail = CustomerMailer.grouped_receipt([purchase.id])
      verify_no_usd_or_dollar_sign(mail)
    end

    it "renders preorder_receipt with ETB currency and no $ or USD" do
      preorder_link = create(:preorder_link, link: product, release_at: 2.days.from_now)
      auth_p = create(:preorder_authorization_purchase, link: product, seller:, email: "buyer@example.com", price_cents: 25_000, displayed_price_currency_type: "etb", charge_processor_id: "chapa")
      preorder = preorder_link.build_preorder(auth_p)
      preorder.save!
      mail = CustomerMailer.preorder_receipt(preorder.id, product.id, "buyer@example.com")
      verify_no_usd_or_dollar_sign(mail)
    end

    it "renders subscription_magic_link without $ or USD" do
      subscription.refresh_token
      mail = CustomerMailer.subscription_magic_link(subscription.id, "buyer@example.com")
      verify_no_usd_or_dollar_sign(mail)
    end

    it "renders subscription_restarted without $ or USD" do
      membership_purchase
      mail = CustomerMailer.subscription_restarted(subscription.id)
      verify_no_usd_or_dollar_sign(mail)
    end
  end

  describe "CustomerLowPriorityMailer" do
    before do
      membership_purchase
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

    it "renders subscription_charge_failed without $ or USD" do
      mail = CustomerLowPriorityMailer.subscription_charge_failed(subscription.id)
      verify_no_usd_or_dollar_sign(mail)
    end

    it "renders credit_card_expiring_membership without $ or USD" do
      mail = CustomerLowPriorityMailer.credit_card_expiring_membership(subscription.id)
      verify_no_usd_or_dollar_sign(mail)
    end

    it "renders free_trial_expiring_soon with ETB currency and no $ or USD" do
      mail = CustomerLowPriorityMailer.free_trial_expiring_soon(subscription.id)
      verify_no_usd_or_dollar_sign(mail)
    end

    it "renders subscription_cancelled without $ or USD" do
      mail = CustomerLowPriorityMailer.subscription_cancelled(subscription.id)
      verify_no_usd_or_dollar_sign(mail)
    end

    it "renders subscription_renewal_reminder with ETB currency and no $ or USD" do
      mail = CustomerLowPriorityMailer.subscription_renewal_reminder(subscription.id)
      verify_no_usd_or_dollar_sign(mail)
    end
  end

  describe "Seller mailers" do
    let(:payment) { create(:payment_returned, user: seller, amount_cents: 10_000, currency: Currency::ETB) }

    it "renders payment_returned with ETB currency and no $ or USD" do
      mail = ContactingCreatorMailer.payment_returned(payment.id)
      verify_no_usd_or_dollar_sign(mail)
      expect(mail.body.encoded).to include("ETB")
      expect(mail.body.encoded).to include("100")
      expect(mail.body.encoded).not_to include("$")
      expect(mail.body.encoded).not_to include("USD")
    end

    it "renders notify (creator sale notification) with ETB currency and no $ or USD" do
      mail = ContactingCreatorMailer.notify(purchase.id)
      verify_no_usd_or_dollar_sign(mail)
    end

    it "renders purchase_refunded with ETB currency and no $ or USD" do
      mail = ContactingCreatorMailer.purchase_refunded(purchase.id)
      verify_no_usd_or_dollar_sign(mail)
    end

    it "renders seller_update with ETB currency and no $ or USD" do
      create(
        :purchase,
        link: product,
        seller:,
        purchaser: buyer,
        price_cents: 25_000,
        charge_processor_id: "chapa",
        created_at: 10.days.ago
      )
      mail = ContactingCreatorMailer.seller_update(seller.id)
      expect(mail).to be_present
      html_part = mail.html_part&.body&.decoded&.force_encoding("UTF-8") || mail.body.encoded
      expect(html_part).not_to include("$")
      expect(html_part).not_to include("USD")
      expect(html_part).to include("250 ETB")
    end
  end
end
