# frozen_string_literal: true

module Chapa
  class PollRefundStatusJob
    include Sidekiq::Job
    sidekiq_options queue: "low", retry: 5

    def perform(ref_id, purchase_id, refund_santims, reason = nil, admin_user_id = nil)
      purchase = Purchase.find_by(id: purchase_id)
      return unless purchase
      return if purchase.stripe_refunded

      admin_user = User.find_by(id: admin_user_id) if admin_user_id
      service = RefundService.new(purchase:, amount_cents: refund_santims, reason:, admin_user:)
      result = service.check_and_finalize_refund(ref_id, refund_santims)

      if result[:success]
        Rails.logger.info("[Chapa::PollRefundStatusJob] Refund #{ref_id} finalized as refunded for purchase #{purchase_id}")
      else
        status = result[:status]
        if status.in?(%w[initiated processing pending])
          # Reschedule retry in 1 minute
          PollRefundStatusJob.perform_in(1.minute, ref_id, purchase_id, refund_santims, reason, admin_user_id)
        else
          Rails.logger.warn("[Chapa::PollRefundStatusJob] Refund #{ref_id} returned terminal non-refunded status: #{status}")
        end
      end
    end
  end
end
