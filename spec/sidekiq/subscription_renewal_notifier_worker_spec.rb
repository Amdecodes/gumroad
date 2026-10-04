# frozen_string_literal: true

require "spec_helper"

RSpec.describe SubscriptionRenewalNotifierWorker do
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

  it "enqueues renewal reminder when subscription is within reminder window (3 days before expiration)" do
    # Expiring in 2 days (Oct 30, when period ends Nov 1)
    travel_to(Time.zone.parse("2026-10-30 12:00:00")) do
      expect(subscription.renewal_due?).to be(true)

      mailer_double = double
      expect(mailer_double).to receive(:deliver_later).with(queue: "low")
      expect(CustomerLowPriorityMailer).to receive(:subscription_renewal_reminder).with(subscription.id).and_return(mailer_double)

      described_class.new.perform
    end
  end

  it "does not enqueue reminder when subscription is not yet due for renewal" do
    # 15 days before expiration (Oct 15)
    travel_to(Time.zone.parse("2026-10-15 12:00:00")) do
      expect(subscription.renewal_due?).to be(false)
      expect(CustomerLowPriorityMailer).not_to receive(:subscription_renewal_reminder)

      described_class.new.perform
    end
  end

  it "skips cancelled or deactivated subscriptions" do
    travel_to(Time.zone.parse("2026-10-30 12:00:00")) do
      subscription.update_columns(cancelled_at: Time.current)
      expect(CustomerLowPriorityMailer).not_to receive(:subscription_renewal_reminder)

      described_class.new.perform
    end
  end
end
