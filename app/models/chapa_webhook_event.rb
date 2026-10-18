# frozen_string_literal: true

class ChapaWebhookEvent < ApplicationRecord
  STATUSES = %w[received processing processed failed].freeze

  validates :idempotency_key, presence: true, uniqueness: true
  validates :event_type, presence: true
  validates :raw_payload, presence: true
  validates :status, presence: true, inclusion: { in: STATUSES }

  scope :unprocessed, -> { where(status: %w[received failed]) }

  def parsed_payload
    return {} if raw_payload.blank?

    JSON.parse(raw_payload)
  rescue JSON::ParserError
    {}
  end

  def mark_processing!
    update!(status: "processing")
  end

  def mark_processed!
    update!(status: "processed", processed_at: Time.current, error_message: nil)
  end

  def mark_failed!(error_msg)
    update!(status: "failed", error_message: error_msg)
  end
end
