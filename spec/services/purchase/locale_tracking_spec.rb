# frozen_string_literal: false

require "spec_helper"

RSpec.describe "Purchase locale tracking across creation paths" do
  let(:seller) { create(:named_seller) }
  let(:buyer) { create(:user) }
  let(:product) { create(:product, user: seller, price_cents: 1000) }
  let(:free_product) { create(:product, user: seller, price_cents: 0) }

  describe "Purchase::CreateService" do
    let(:base_params) do
      {
        purchase: {
          email: "buyer@example.com",
          full_name: "Test Buyer",
          quantity: 1,
          perceived_price_cents: 1000,
          ip_address: "127.0.0.1",
          session_id: "test-session-id",
        }
      }
    end

    it "sets purchase.locale from request params when locale is am" do
      params = base_params.merge(locale: "am")
      service = Purchase::CreateService.new(product:, params:, buyer:)
      purchase, = service.perform
      expect(purchase.locale).to eq("am")
    end

    it "defaults purchase.locale to en when unspecified" do
      service = Purchase::CreateService.new(product:, params: base_params, buyer:)
      purchase, = service.perform
      expect(purchase.locale).to eq("en")
    end

    it "falls back to default locale when unsupported locale is provided" do
      params = base_params.merge(locale: "fr")
      service = Purchase::CreateService.new(product:, params:, buyer:)
      purchase, = service.perform
      expect(purchase.locale).to eq("en")
    end

    it "sets purchase.locale on free/zero-price purchases" do
      free_params = {
        purchase: {
          email: "free_buyer@example.com",
          full_name: "Free Buyer",
          quantity: 1,
          perceived_price_cents: 0,
          ip_address: "127.0.0.1",
          session_id: "test-session-id",
        },
        locale: "am"
      }
      service = Purchase::CreateService.new(product: free_product, params: free_params, buyer:)
      purchase, = service.perform
      expect(purchase.locale).to eq("am")
      expect(purchase.price_cents).to eq(0)
    end

    it "sets purchase.locale on both gifter and giftee purchase when gifting" do
      gift_params = {
        is_gift: true,
        purchase: {
          email: "gifter@example.com",
          full_name: "Gifter Name",
          quantity: 1,
          perceived_price_cents: 1000,
          ip_address: "127.0.0.1",
          session_id: "test-session-id",
        },
        gift: {
          giftee_email: "giftee@example.com",
          gift_note: "Enjoy this gift!",
          hide_gifter: false
        },
        locale: "am"
      }
      service = Purchase::CreateService.new(product:, params: gift_params, buyer:)
      gifter_purchase, = service.perform
      expect(gifter_purchase.locale).to eq("am")
      expect(gifter_purchase.is_gift_sender_purchase).to be(true)

      # Check giftee purchase generated during gift flow
      giftee_purchase = gifter_purchase.gift_given.giftee_purchase
      expect(giftee_purchase).to be_present
      expect(giftee_purchase.locale).to eq("am")
      expect(giftee_purchase.is_gift_receiver_purchase).to be(true)
    end
  end

  describe "Subscription renewals (Subscription#build_purchase)" do
    let(:membership_product) { create(:membership_product, subscription_duration: "monthly", user: seller) }
    let(:subscription) { create(:subscription, link: membership_product, user: buyer) }

    let!(:original_purchase) do
      create(
        :purchase,
        link: membership_product,
        subscription:,
        is_original_subscription_purchase: true,
        purchase_state: "successful",
        locale: "am",
        email: buyer.email
      )
    end

    it "copies locale from original purchase for renewal purchases" do
      renewal_purchase = subscription.build_purchase
      expect(renewal_purchase.locale).to eq("am")
    end

    it "allows overriding locale explicitly if provided" do
      renewal_purchase = subscription.build_purchase(override_params: { locale: "en" })
      expect(renewal_purchase.locale).to eq("en")
    end
  end

  describe "Bundle product purchases (Purchase::CreateBundleProductPurchaseService)" do
    let(:bundle) { create(:product, user: seller, is_bundle: true) }
    let(:bundled_product) { create(:product, user: seller) }
    let!(:bundle_product) { create(:bundle_product, bundle:, product: bundled_product, quantity: 1) }
    let(:bundle_purchase) { create(:purchase, link: bundle, purchaser: buyer, locale: "am") }

    it "inherits locale from the parent bundle purchase" do
      Purchase::CreateBundleProductPurchaseService.new(bundle_purchase, bundle_product).perform
      component_purchase = Purchase.last
      expect(component_purchase.locale).to eq("am")
      expect(component_purchase.is_bundle_product_purchase).to be(true)
    end
  end

  describe "Preorders (Preorder#charge!)" do
    let(:preorder_product) { create(:product, is_in_preorder_state: false, user: seller) }
    let(:preorder_link) do
      link = create(:preorder_link, link: preorder_product, release_at: 2.days.from_now)
      link.update_columns(release_at: 1.day.ago)
      link
    end
    let(:preorder) { create(:preorder, preorder_link:, seller:, purchaser: buyer, state: "authorization_successful") }
    let!(:authorization_purchase) do
      auth = create(:preorder_authorization_purchase, link: preorder_product, seller:, purchaser: buyer, locale: "am")
      auth.update!(preorder:)
      auth
    end

    it "copies locale from authorization purchase when charging preorder" do
      expect(Purchase).to receive(:new).with(hash_including(locale: "am")).and_call_original
      allow_any_instance_of(Purchase).to receive(:ensure_completion)
      preorder.charge!
    end
  end
end
