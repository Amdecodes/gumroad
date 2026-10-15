# frozen_string_literal: true

require "spec_helper"

describe "Platform and Discover fee computation" do
  let(:seller) { create(:user) }
  let(:product) { create(:product, user: seller, price_cents: 10_000) }

  describe "Link discover fee validation and defaults" do
    it "defaults discover_fee_per_thousand to 300 on create" do
      link = create(:product, user: seller)
      expect(link.discover_fee_per_thousand).to eq(300)
    end

    it "allows discover_fee_per_thousand = 300" do
      link = build(:product, user: seller, discover_fee_per_thousand: 300)
      expect(link).to be_valid
    end

    it "rejects discover_fee_per_thousand values other than 300" do
      [100, 200, 299, 301, 400, 500, 1000].each do |invalid_rate|
        link = build(:product, user: seller)
        link.discover_fee_per_thousand = invalid_rate
        expect(link).not_to be_valid
        expect(link.errors[:discover_fee_per_thousand]).to be_present
      end
    end
  end

  describe "Normal sales (15% platform fee, 0 fixed fee)" do
    it "computes 15% flat fee with zero fixed fee for Chapa purchases across price scales" do
      # 100 ETB (10,000 cents) -> 15 ETB (1,500 cents) fee, 85 ETB (8,500 cents) creator net
      p1 = build(:purchase, link: product, seller:, price_cents: 10_000, charge_processor_id: "chapa")
      p1.calculate_fees
      expect(p1.fee_cents).to eq(1_500)
      expect(p1.price_cents - p1.fee_cents).to eq(8_500)

      # 1,000 ETB (100,000 cents) -> 150 ETB (15,000 cents) fee, 850 ETB (85,000 cents) creator net
      p2 = build(:purchase, link: product, seller:, price_cents: 100_000, charge_processor_id: "chapa")
      p2.calculate_fees
      expect(p2.fee_cents).to eq(15_000)
      expect(p2.price_cents - p2.fee_cents).to eq(85_000)

      # 10,000 ETB (1,000,000 cents) -> 1,500 ETB (150,000 cents) fee, 8,500 ETB (850,000 cents) creator net
      p3 = build(:purchase, link: product, seller:, price_cents: 1_000_000, charge_processor_id: "chapa")
      p3.calculate_fees
      expect(p3.fee_cents).to eq(150_000)
      expect(p3.price_cents - p3.fee_cents).to eq(850_000)
    end
  end

  describe "Discover sales (30% flat fee, not stacked, 0 fixed fee)" do
    before do
      allow_any_instance_of(Link).to receive(:recommendable?).and_return(true)
    end

    def build_discover_purchase(price_cents)
      p = build(
        :purchase,
        link: product,
        seller:,
        price_cents:,
        charge_processor_id: "chapa",
        was_product_recommended: true,
        recommended_by: RecommendationType::GUMROAD_DISCOVER_RECOMMENDATION
      )
      rec = build(:recommended_purchase_info_via_discover, purchase: p, discover_fee_per_thousand: 300)
      p.recommended_purchase_info = rec
      p
    end

    it "computes 30% flat fee with zero fixed fee for Discover Chapa purchases across price scales" do
      # 100 ETB (10,000 cents) -> 30 ETB (3,000 cents) fee, 70 ETB (7,000 cents) creator net
      p1 = build_discover_purchase(10_000)
      p1.calculate_fees
      expect(p1.fee_cents).to eq(3_000)
      expect(p1.price_cents - p1.fee_cents).to eq(7_000)

      # 1,000 ETB (100,000 cents) -> 300 ETB (30,000 cents) fee, 700 ETB (70,000 cents) creator net
      p2 = build_discover_purchase(100_000)
      p2.calculate_fees
      expect(p2.fee_cents).to eq(30_000)
      expect(p2.price_cents - p2.fee_cents).to eq(70_000)

      # 10,000 ETB (1,000,000 cents) -> 3,000 ETB (300,000 cents) fee, 7,000 ETB (700,000 cents) creator net
      p3 = build_discover_purchase(1_000_000)
      p3.calculate_fees
      expect(p3.fee_cents).to eq(300_000)
      expect(p3.price_cents - p3.fee_cents).to eq(700_000)
    end
  end

  describe "Recurring subscription charge fee flow" do
    let(:membership_product) { create(:membership_product, user: seller, price_cents: 10_000) }
    let(:original_purchase) do
      create(:purchase, link: membership_product, seller:, price_cents: 10_000, charge_processor_id: "chapa")
    end
    let(:subscription) do
      create(:subscription, link: membership_product, original_purchase:, user: create(:user))
    end

    it "computes 15% normal fee on recurring subscription renewal" do
      renewal = build(
        :purchase,
        link: membership_product,
        seller:,
        price_cents: 10_000,
        charge_processor_id: "chapa",
        subscription:
      )
      renewal.calculate_fees
      expect(renewal.fee_cents).to eq(1_500)
    end

    it "computes 30% Discover fee on recurring subscription renewal when original was Discover" do
      rec = create(:recommended_purchase_info_via_discover, purchase: original_purchase, discover_fee_per_thousand: 300)
      original_purchase.update!(recommended_purchase_info: rec, was_discover_fee_charged: true, was_product_recommended: true, recommended_by: RecommendationType::GUMROAD_DISCOVER_RECOMMENDATION)

      renewal = build(
        :purchase,
        link: membership_product,
        seller:,
        price_cents: 10_000,
        charge_processor_id: "chapa",
        subscription:,
        was_product_recommended: true,
        recommended_by: RecommendationType::GUMROAD_DISCOVER_RECOMMENDATION
      )
      rec_renewal = build(:recommended_purchase_info_via_discover, purchase: renewal, discover_fee_per_thousand: 300)
      renewal.recommended_purchase_info = rec_renewal

      renewal.calculate_fees
      expect(renewal.fee_cents).to eq(3_000)
    end
  end

  describe "Preorder fee flow" do
    let(:preorder_link) { create(:preorder_link, link: product, release_at: 2.days.from_now) }
    let(:auth_purchase) do
      create(:preorder_authorization_purchase, link: product, seller:, price_cents: 10_000, charge_processor_id: "chapa")
    end
    let(:preorder) { preorder_link.build_preorder(auth_purchase).tap(&:save!) }

    it "computes 15% normal fee on preorder charge" do
      charge_purchase = build(
        :purchase,
        link: product,
        seller:,
        price_cents: 10_000,
        charge_processor_id: "chapa",
        preorder:
      )
      charge_purchase.calculate_fees
      expect(charge_purchase.fee_cents).to eq(1_500)
    end

    it "computes 30% Discover fee on preorder charge when auth was Discover" do
      allow_any_instance_of(Link).to receive(:recommendable?).and_return(true)
      rec_auth = create(:recommended_purchase_info_via_discover, purchase: auth_purchase, discover_fee_per_thousand: 300)
      auth_purchase.update!(recommended_purchase_info: rec_auth, was_discover_fee_charged: true, was_product_recommended: true, recommended_by: RecommendationType::GUMROAD_DISCOVER_RECOMMENDATION)

      charge_purchase = build(
        :purchase,
        link: product,
        seller:,
        price_cents: 10_000,
        charge_processor_id: "chapa",
        preorder:,
        was_product_recommended: true,
        recommended_by: RecommendationType::GUMROAD_DISCOVER_RECOMMENDATION
      )
      rec = build(:recommended_purchase_info_via_discover, purchase: charge_purchase, discover_fee_per_thousand: 300)
      charge_purchase.recommended_purchase_info = rec

      charge_purchase.calculate_fees
      expect(charge_purchase.fee_cents).to eq(3_000)
    end
  end

  describe "Gift fee flow" do
    it "computes 15% fee on gift purchase and 0 fee on giftee receiver purchase" do
      giver = build(:purchase, link: product, seller:, price_cents: 10_000, charge_processor_id: "chapa", is_gift_sender_purchase: true)
      giver.calculate_fees
      expect(giver.fee_cents).to eq(1_500)

      receiver = build(:purchase, link: product, seller:, price_cents: 0, charge_processor_id: "chapa", purchase_state: "gift_receiver_purchase_successful")
      receiver.calculate_fees
      expect(receiver.fee_cents).to eq(0)
    end
  end

  describe "Bundle fee flow" do
    it "computes 15% fee on bundle sales and 30% on Discover bundle sales" do
      bundle = create(:product, :bundle, user: seller, price_cents: 10_000)
      bundle_purchase = build(:purchase, link: bundle, seller:, price_cents: 10_000, charge_processor_id: "chapa")
      bundle_purchase.calculate_fees
      expect(bundle_purchase.fee_cents).to eq(1_500)

      discover_bundle_purchase = build(
        :purchase,
        link: bundle,
        seller:,
        price_cents: 10_000,
        charge_processor_id: "chapa",
        was_product_recommended: true,
        recommended_by: RecommendationType::GUMROAD_DISCOVER_RECOMMENDATION
      )
      allow_any_instance_of(Link).to receive(:recommendable?).and_return(true)
      rec = build(:recommended_purchase_info_via_discover, purchase: discover_bundle_purchase, discover_fee_per_thousand: 300)
      discover_bundle_purchase.recommended_purchase_info = rec
      discover_bundle_purchase.calculate_fees
      expect(discover_bundle_purchase.fee_cents).to eq(3_000)
    end
  end

  describe "Refund flows" do
    let(:purchase) do
      create(:purchase, link: product, seller:, price_cents: 10_000, charge_processor_id: "chapa").tap do |p|
        p.calculate_fees
        p.save!
      end
    end

    it "recovers proportional 15% fee on full refund" do
      expect(purchase.fee_cents).to eq(1_500)
      full_refund = purchase.build_refund(gross_refund_amount: 10_000, refunding_user_id: seller.id)
      expect(full_refund.fee_cents).to eq(1_500)
      expect(full_refund.amount_cents).to eq(10_000)
    end

    it "recovers proportional 15% fee on partial refund" do
      expect(purchase.fee_cents).to eq(1_500)
      # Partial refund of 50 ETB (5,000 cents) -> fee refund should be exactly 50% of 1,500 = 750
      partial_refund = purchase.build_refund(gross_refund_amount: 5_000, refunding_user_id: seller.id)
      expect(partial_refund.fee_cents).to eq(750)
      expect(partial_refund.amount_cents).to eq(5_000)
    end
  end
end
