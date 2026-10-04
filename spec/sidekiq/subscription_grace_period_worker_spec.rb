# frozen_string_literal: true

require "spec_helper"

RSpec.describe SubscriptionGracePeriodWorker do
  let(:seller) { create(:named_seller) }
  let(:subscriber) { create(:user) }
  let(:product) { create(:membership_product, subscription_duration: "monthly", user: seller, price_currency_type: "etb") }
  let(:subscription) { create(:subscription, link: product, user: subscriber) }

  let!(:original_purchase) do
    travel_to(Time.zone.parse("2026-10-01 12:00:00")) do
      create(
        :purchase,
        link: product,
        seller:,
        subscription:,
        is_original_subscription_purchase: true,
        purchase_state: "successful",
        succeeded_at: Time.current,
        price_cents: 25000,
        displayed_price_cents: 25000,
        displayed_price_currency_type: "etb"
      )
    end
  end

  it "suspends subscriptions that are overdue for renewal and past the 5-day grace period" do
    # Expired on Nov 1, grace period ends Nov 6. At Nov 7, grace period is expired.
    travel_to(Time.zone.parse("2026-11-07 12:00:00")) do
      expect(subscription.overdue_for_charge?).to be(true)
      expect(subscription.in_grace_period?).to be(false)

      described_class.new.perform

      subscription.reload
      expect(subscription.failed_at).to be_present
      expect(subscription.deactivated_at).to be_present
    end
  end

  it "preserves access when subscription is within the 5-day grace period" do
    # Expired on Nov 1. At Nov 3 (2 days into grace period), access is preserved.
    travel_to(Time.zone.parse("2026-11-03 12:00:00")) do
      expect(subscription.overdue_for_charge?).to be(true)
      expect(subscription.in_grace_period?).to be(true)

      described_class.new.perform

      subscription.reload
      expect(subscription.failed_at).to be_nil
      expect(subscription.deactivated_at).to be_nil
    end
  end

  it "does not expire subscriptions that are active and not overdue" do
    travel_to(Time.zone.parse("2026-10-15 12:00:00")) do
      expect(subscription.overdue_for_charge?).to be(false)

      described_class.new.perform

      subscription.reload
      expect(subscription.failed_at).to be_nil
      expect(subscription.deactivated_at).to be_nil
    end
  end
end
