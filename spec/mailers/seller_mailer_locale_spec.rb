# frozen_string_literal: true

require "spec_helper"

describe "Seller mailer locale handling" do
  describe "ContactingCreatorMailer" do
    let(:seller_am) { create(:named_user, locale: "am") }
    let(:seller_pseudo) { create(:named_user, locale: "pseudo") }
    let(:seller_en) { create(:named_user, locale: "en") }

    let(:product_am) { create(:product, user: seller_am, name: "የመጽሐፍ ቅጂ", price_cents: 1000) }
    let(:purchase_am) { create(:purchase, link: product_am, seller: seller_am, email: "buyer@example.com", full_name: "አበበ") }

    it "renders notify in Amharic when seller has locale: 'am'" do
      mail = ContactingCreatorMailer.notify(purchase_am.id)

      expect(mail.to).to eq([seller_am.email])
      expect(mail.subject).to include("አዲስ የ")
      expect(mail.subject).to include("የመጽሐፍ ቅጂ")
      body = mail.body.encoded

      expect(body).to include("ደንበኛ")
      expect(body).to include("ኢሜይል")
      expect(body).to include("የሂሳብ ቀሪ ይመልከቱ")
      expect(body).to include("ብዛት")
      expect(body).to include("አበበ")
    end

    it "renders notify in pseudo-locale when seller has locale: 'pseudo'" do
      product_pseudo = create(:product, user: seller_pseudo, name: "Pseudo Book", price_cents: 1000)
      purchase_pseudo = create(:purchase, link: product_pseudo, seller: seller_pseudo, email: "buyer@example.com", full_name: "Tester")

      mail = ContactingCreatorMailer.notify(purchase_pseudo.id)

      expect(mail.subject).to include("⟦")
      expect(mail.subject).to include("⟧")
      body = mail.body.encoded

      expect(body).to include("⟦")
      expect(body).to include("⟧")
    end

    it "renders cannot_pay in seller's locale" do
      payment = create(:payment, user: seller_am)
      mail = ContactingCreatorMailer.cannot_pay(payment.id)

      expect(mail.subject).to eq("ክፍያዎን መፈጸም አልቻልንም።")
    end

    it "renders seller_update in seller's locale" do
      mail = ContactingCreatorMailer.seller_update(seller_am.id)

      expect(mail.subject).to eq("ያለፈው ሳምንትዎ።")
    end
  end

  describe "CreatorMailer" do
    let(:user_am) { create(:named_user, locale: "am") }

    it "renders top_creator_announcement in user's locale" do
      mail = CreatorMailer.top_creator_announcement(user_id: user_am.id)

      expect(mail.subject).to eq("እርስዎ ምርጥ ሻጭ ነዎት!")
      body = mail.body.encoded
      expect(body).to include("በ#{PlatformConfig::APP_NAME} ላይ ከፍተኛ ሻጭ ባጅ አግኝተዋል።")
      expect(body).to include("ምርጥ ሻጭ")
    end

    it "renders scheduled_payout_chargeback_hold in user's locale" do
      payout = create(:scheduled_payout, user: user_am, action: "payout")
      mail = CreatorMailer.scheduled_payout_chargeback_hold(scheduled_payout_id: payout.id)

      expect(mail.subject).to eq("ክፍያዎ ዘግይቷል")
    end

    it "renders bundles_marketing in seller's locale" do
      mail = CreatorMailer.bundles_marketing(seller_id: user_am.id)

      expect(mail.subject).to eq("ከ$300,000 በላይ ጥቅል ምርቶችን ከሸጡ ምርጥ ሻጮች ጋር ይቀላቀሉ")
    end
  end

  describe "AffiliateMailer" do
    let(:seller_am) { create(:named_user, locale: "am") }
    let(:affiliate_user_am) { create(:named_user, locale: "am") }
    let(:affiliate_user_en) { create(:named_user, locale: "en") }

    it "renders direct_affiliate_removal_by_affiliate_user in seller's locale" do
      direct_affiliate = create(:direct_affiliate, seller: seller_am, affiliate_user: affiliate_user_en)
      mail = AffiliateMailer.direct_affiliate_removal_by_affiliate_user(direct_affiliate.id)

      expect(mail.to).to eq([seller_am.form_email])
      expect(mail.subject).to eq("#{affiliate_user_en.name} ከአፊሊዬት ፕሮግራምዎ ወጥቷል")
    end

    it "renders direct_affiliate_invitation in affiliate's locale" do
      product = create(:product, user: seller_am, name: "Product 1")
      direct_affiliate = create(:direct_affiliate, seller: seller_am, affiliate_user: affiliate_user_am, products: [product])
      mail = AffiliateMailer.direct_affiliate_invitation(direct_affiliate.id)

      expect(mail.to).to eq([affiliate_user_am.form_email])
      expect(mail.subject).to eq("#{seller_am.name} እንደ አፊሊዬት አካትቶዎታል")
    end

    it "renders collaborator_invitation_accepted in inviter (seller) locale" do
      collaborator = create(:collaborator, seller: seller_am, affiliate_user: affiliate_user_en)
      mail = AffiliateMailer.collaborator_invitation_accepted(collaborator.id)

      expect(mail.to).to eq([seller_am.form_email])
      expect(mail.subject).to eq("#{affiliate_user_en.name} በ#{PlatformConfig::APP_NAME} ላይ አብሮ ለመስራት የቀረበለትን ግብዣ ተቀብሏል")
    end

    it "renders collaborator_invitation_declined in inviter (seller) locale" do
      collaborator = create(:collaborator, seller: seller_am, affiliate_user: affiliate_user_en)
      mail = AffiliateMailer.collaborator_invitation_declined(collaborator.id)

      expect(mail.to).to eq([seller_am.form_email])
      expect(mail.subject).to eq("#{affiliate_user_en.name} በ#{PlatformConfig::APP_NAME} ላይ አብሮ ለመስራት የቀረበለትን ግብዣ አልተቀበለም")
    end
  end

  describe "AffiliateRequestMailer" do
    let(:seller_am) { create(:named_user, locale: "am") }
    let(:requester_am) { create(:named_user, locale: "am") }

    it "renders notify_seller_of_new_request in seller's locale" do
      affiliate_request = create(:affiliate_request, seller: seller_am, email: "someone@example.com", name: "ዮናስ")
      mail = AffiliateRequestMailer.notify_seller_of_new_request(affiliate_request.id)

      expect(mail.to).to eq([seller_am.email])
      expect(mail.subject).to eq("ዮናስ አፊሊዬት ለመሆን አመልክቷል")
    end

    it "renders notify_requester_of_request_submission in requester's locale" do
      affiliate_request = create(:affiliate_request, seller: seller_am, email: requester_am.email, name: requester_am.name)
      mail = AffiliateRequestMailer.notify_requester_of_request_submission(affiliate_request.id)

      expect(mail.to).to eq([requester_am.email])
      expect(mail.subject).to eq("ለ#{seller_am.display_name} የቀረበው የማመልከቻ ጥያቄዎ ገብቷል!")
    end
  end

  describe "AccountingMailer" do
    let(:user_am) { create(:named_user, locale: "am") }

    it "renders ytd_sales_report in recipient's locale" do
      mail = AccountingMailer.ytd_sales_report("csv_content", user_am.email)

      expect(mail.to).to eq([user_am.email])
      expect(mail.subject).to eq("የዓመቱ እስካሁን የሽያጭ ሪፖርት በሀገር/ክልል")
    end
  end

  describe "MerchantRegistrationMailer" do
    let(:user_am) { create(:named_user, locale: "am") }

    it "renders stripe_account_rejected in user's locale" do
      create(:merchant_account, user: user_am, stripe_disabled_reason: "rejected.listed")
      mail = MerchantRegistrationMailer.stripe_account_rejected(user_am.id)

      expect(mail.to).to eq([user_am.email])
      expect(mail.subject).to eq("በ#{PlatformConfig::APP_NAME} ላይ ክፍያዎችን ከአሁን በኋላ መቀበል አይችሉም")
    end

    it "renders account_deauthorized_to_user in user's locale" do
      mail = MerchantRegistrationMailer.account_deauthorized_to_user(user_am.id, StripeChargeProcessor.charge_processor_id)

      expect(mail.to).to eq([user_am.email])
      expect(mail.subject).to eq("የክፍያ መለያ ተቋርጧል - #{user_am.external_id}")
    end
  end

  describe "TeamMailer" do
    let(:seller_am) { create(:named_user, locale: "am") }
    let(:team_member) { create(:named_user, locale: "am") }

    it "renders invite in recipient/seller locale" do
      team_invitation = create(:team_invitation, seller: seller_am, email: team_member.email)
      mail = TeamMailer.invite(team_invitation)

      expect(mail.to).to eq([team_member.email])
      expect(mail.subject).to eq("የ#{PlatformConfig::APP_NAME} የቡድን ግብዣ")
    end

    it "renders invitation_accepted in seller's locale" do
      team_membership = create(:team_membership, seller: seller_am, user: team_member)
      mail = TeamMailer.invitation_accepted(team_membership)

      expect(mail.to).to eq([seller_am.email])
      expect(mail.subject).to eq("#{team_member.display_name} ግብዣዎን ተቀብሏል")
    end
  end
end
