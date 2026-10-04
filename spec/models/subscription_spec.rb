# frozen_string_literal: true

require "spec_helper"

RSpec.describe Subscription do
  let(:seller) { create(:named_seller) }
  let(:subscriber) { create(:user) }
  let(:product) { create(:membership_product, subscription_duration: "monthly", user: seller) }
  let(:subscription) { create(:subscription, link: product, user: subscriber) }

  describe "period calculation and manual renewal extension" do
    let!(:original_purchase) do
      travel_to(Time.zone.parse("2026-10-01 12:00:00")) do
        create(
          :purchase,
          link: product,
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

    it "calculates initial subscription period accurately" do
      travel_to(Time.zone.parse("2026-10-15 12:00:00")) do
        expected_end = Time.zone.parse("2026-11-01 12:00:00")
        expect(subscription.end_time_of_subscription).to eq(expected_end)
        expect(subscription.current_period_ends_at).to eq(expected_end)
        expect(subscription.valid_until).to eq(expected_end)
      end
    end

    it "extends period from previous cycle end when renewed before expiration" do
      # Buyer renews on Oct 28 (3 days before Nov 1 expiration)
      renewal_purchase = nil
      travel_to(Time.zone.parse("2026-10-28 10:00:00")) do
        renewal_purchase = create(
          :purchase,
          link: product,
          subscription:,
          is_original_subscription_purchase: false,
          purchase_state: "in_progress",
          price_cents: 25000,
          displayed_price_cents: 25000,
          displayed_price_currency_type: "etb"
        )
        subscription.advance_renewal_period!(renewal_purchase)
      end

      # Next period should end on Dec 1 (continuous coverage from Nov 1)
      expected_end = Time.zone.parse("2026-12-01 12:00:00")
      expect(subscription.reload.end_time_of_subscription).to eq(expected_end)
      expect(renewal_purchase.reload.successful?).to be(true)
    end

    it "extends period from previous cycle end when renewed during 5-day grace period" do
      # Period 1 expired on Nov 1. Buyer renews on Nov 3 (within 5-day grace period)
      renewal_purchase = nil
      travel_to(Time.zone.parse("2026-11-03 14:00:00")) do
        renewal_purchase = create(
          :purchase,
          link: product,
          subscription:,
          is_original_subscription_purchase: false,
          purchase_state: "in_progress",
          price_cents: 25000,
          displayed_price_cents: 25000,
          displayed_price_currency_type: "etb"
        )
        subscription.advance_renewal_period!(renewal_purchase)
      end

      # Continuous coverage from Nov 1 to Dec 1
      expected_end = Time.zone.parse("2026-12-01 12:00:00")
      expect(subscription.reload.end_time_of_subscription).to eq(expected_end)
      expect(renewal_purchase.reload.successful?).to be(true)
    end

    it "restarts coverage from renewal date when renewed past grace period" do
      # Period 1 ended Nov 1. Grace period ended Nov 6. Buyer renews on Nov 20.
      renewal_purchase = nil
      travel_to(Time.zone.parse("2026-11-20 09:00:00")) do
        renewal_purchase = create(
          :purchase,
          link: product,
          subscription:,
          is_original_subscription_purchase: false,
          purchase_state: "in_progress",
          price_cents: 25000,
          displayed_price_cents: 25000,
          displayed_price_currency_type: "etb"
        )
        subscription.advance_renewal_period!(renewal_purchase)
      end

      # New period extends 1 month from Nov 20 -> Dec 20
      expected_end = Time.zone.parse("2026-12-20 09:00:00")
      expect(subscription.reload.end_time_of_subscription).to eq(expected_end)
      expect(renewal_purchase.reload.successful?).to be(true)
    end

    it "is idempotent and does not extend period twice for the same renewal purchase" do
      renewal_purchase = nil
      travel_to(Time.zone.parse("2026-10-28 10:00:00")) do
        renewal_purchase = create(
          :purchase,
          link: product,
          subscription:,
          is_original_subscription_purchase: false,
          purchase_state: "in_progress",
          price_cents: 25000,
          displayed_price_cents: 25000,
          displayed_price_currency_type: "etb"
        )
        subscription.advance_renewal_period!(renewal_purchase)
      end

      first_end = subscription.reload.end_time_of_subscription
      expect(first_end).to eq(Time.zone.parse("2026-12-01 12:00:00"))

      # Re-executing advance with the same purchase must not alter end date
      subscription.advance_renewal_period!(renewal_purchase)
      expect(subscription.reload.end_time_of_subscription).to eq(first_end)
    end
  end

  describe "grace period and status indicators" do
    before do
      travel_to(Time.zone.parse("2026-10-01 12:00:00")) do
        create(
          :purchase,
          link: product,
          subscription:,
          is_original_subscription_purchase: true,
          purchase_state: "successful",
          succeeded_at: Time.current,
          price_cents: 25000
        )
      end
    end

    it "reports active when not near expiration" do
      travel_to(Time.zone.parse("2026-10-15 12:00:00")) do
        expect(subscription.alive?).to be(true)
        expect(subscription.renewal_due?).to be(false)
        expect(subscription.in_grace_period?).to be(false)
        expect(subscription.display_status_label).to eq("Active")
      end
    end

    it "reports renewal_due when within 3 days of expiration" do
      travel_to(Time.zone.parse("2026-10-30 12:00:00")) do
        expect(subscription.alive?).to be(true)
        expect(subscription.renewal_due?).to be(true)
        expect(subscription.in_grace_period?).to be(false)
        expect(subscription.display_status_label).to eq("Renewal Due")
      end
    end

    it "reports grace period when expired within 5 days" do
      travel_to(Time.zone.parse("2026-11-03 12:00:00")) do
        expect(subscription.alive?).to be(true)
        expect(subscription.in_grace_period?).to be(true)
        expect(subscription.renewal_due?).to be(true)
        expect(subscription.grace_period_days_left).to be > 0
        expect(subscription.display_status_label).to include("Grace Period")
      end
    end

    it "suspends access past grace period" do
      travel_to(Time.zone.parse("2026-11-08 12:00:00")) do
        expect(subscription.in_grace_period?).to be(false)
        subscription.expire_past_grace_period!

        expect(subscription.reload.alive?).to be(false)
        expect(subscription.failed_at).to be_present
        expect(subscription.deactivated_at).to be_present
        expect(subscription.display_status_label).to eq("Past Due")
      end
    end
  end
end
