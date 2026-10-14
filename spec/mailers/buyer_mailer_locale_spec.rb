# frozen_string_literal: true

require "spec_helper"

describe "Buyer mailer locale handling" do
  let(:seller) { create(:named_seller, name: "Abebe Seller") }
  let(:product) { create(:product, user: seller, name: "Amharic Masterclass") }

  def decoded_body(mail)
    if mail.parts.any?
      mail.parts.map { |p| p.body.decoded.force_encoding("UTF-8") }.join("\n")
    else
      mail.body.decoded.force_encoding("UTF-8")
    end
  end

  describe "CustomerMailer.receipt" do
    let(:am_purchase) { create(:purchase, link: product, seller:, email: "buyer@example.com", locale: "am") }
    let(:en_purchase) { create(:purchase, link: product, seller:, email: "buyer@example.com", locale: "en") }

    before do
      am_purchase.create_url_redirect!
      en_purchase.create_url_redirect!
    end

    it "renders Amharic subject and body when purchase locale is am even if enqueued from en request" do
      mail = I18n.with_locale(:en) do
        CustomerMailer.receipt(am_purchase.id)
      end

      expect(mail.subject).to eq("የ#{product.name} ግዢ ፈጽመዋል!")
      expect(decoded_body(mail)).to include("ይዘትን ይመልከቱ")
      expect(decoded_body(mail)).to include('class="lang-am"')
    end

    it "renders English subject and body when purchase locale is en even if enqueued from am request" do
      mail = I18n.with_locale(:am) do
        CustomerMailer.receipt(en_purchase.id)
      end

      expect(mail.subject).to eq("You bought #{product.name}!")
      expect(decoded_body(mail)).to include("View content")
    end
  end

  describe "CustomerMailer.refund" do
    let(:am_purchase) { create(:purchase, link: product, seller:, email: "buyer@example.com", locale: "am") }
    let(:en_purchase) { create(:purchase, link: product, seller:, email: "buyer@example.com", locale: "en") }

    it "renders Amharic subject when purchase locale is am even if enqueued from en request" do
      mail = I18n.with_locale(:en) do
        CustomerMailer.refund(am_purchase.email, product.id, am_purchase.id)
      end

      expect(mail.subject).to eq("ተመላሽ ገንዘብ ተደርጎልዎታል።")
      expect(decoded_body(mail)).to include("ተመላሽ")
    end

    it "renders English subject when purchase locale is en even if enqueued from am request" do
      mail = I18n.with_locale(:am) do
        CustomerMailer.refund(en_purchase.email, product.id, en_purchase.id)
      end

      expect(mail.subject).to eq("You have been refunded.")
      expect(decoded_body(mail)).to include("fully refunded")
    end
  end

  describe "CustomerLowPriorityMailer subscription emails" do
    let(:membership_product) { create(:membership_product, user: seller, name: "VIP Club") }
    let(:subscription) { create(:subscription, link: membership_product) }
    let!(:am_original_purchase) do
      create(
        :membership_purchase,
        link: membership_product,
        subscription:,
        is_original_subscription_purchase: true,
        locale: "am"
      )
    end

    it "renders Amharic subject for subscription_ended when purchase locale is am even if caller is en" do
      mail = I18n.with_locale(:en) do
        CustomerLowPriorityMailer.subscription_ended(subscription.id)
      end

      expect(mail.subject).to eq("የአባልነት ምዝገባዎ አብቅቷል።")
      expect(decoded_body(mail)).to include("አብቅቷል")
    end

    it "renders English subject for subscription_ended when purchase locale is en even if caller is am" do
      am_original_purchase.update!(locale: "en")
      subscription.user&.update!(locale: "en")

      mail = I18n.with_locale(:am) do
        CustomerLowPriorityMailer.subscription_ended(subscription.id)
      end

      expect(mail.subject).to eq("Your subscription has ended.")
      expect(decoded_body(mail)).to include("has ended")
    end

    it "renders Amharic subject for subscription_cancelled when purchase locale is am even if caller is en" do
      mail = I18n.with_locale(:en) do
        CustomerLowPriorityMailer.subscription_cancelled(subscription.id)
      end

      expect(mail.subject).to eq("የአባልነት ምዝገባዎ ተሰርዟል።")
      expect(decoded_body(mail)).to include("ተሰርዟል")
    end

    it "renders English subject for subscription_cancelled when purchase locale is en even if caller is am" do
      am_original_purchase.update!(locale: "en")
      subscription.user&.update!(locale: "en")

      mail = I18n.with_locale(:am) do
        CustomerLowPriorityMailer.subscription_cancelled(subscription.id)
      end

      expect(mail.subject).to eq("Your subscription has been canceled.")
      expect(decoded_body(mail)).to include("has been canceled")
    end
  end
end
