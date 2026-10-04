# frozen_string_literal: true

class SubscriptionGracePeriodWorker
  include Sidekiq::Job
  sidekiq_options retry: 3, queue: :default

  def perform
    Subscription.where(deactivated_at: nil, failed_at: nil, ended_at: nil)
                .not_is_test_subscription
                .find_each do |subscription|
      next if subscription.in_free_trial? || subscription.charges_completed?
      next unless subscription.overdue_for_charge?
      next if subscription.in_grace_period?

      subscription.expire_past_grace_period!
    end
  end
end
