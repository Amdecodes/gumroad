# frozen_string_literal: true

class SubscriptionRenewalNotifierWorker
  include Sidekiq::Job
  sidekiq_options retry: 3, queue: :default

  def perform
    Subscription.active_without_pending_cancel
                .where(ended_at: nil, failed_at: nil, deactivated_at: nil)
                .find_each do |subscription|
      next if subscription.in_free_trial? || subscription.charges_completed?
      next unless subscription.renewal_due?

      CustomerLowPriorityMailer.subscription_renewal_reminder(subscription.id).deliver_later(queue: "low")
    end
  end
end
