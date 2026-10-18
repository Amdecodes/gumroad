# frozen_string_literal: true

class ChapaTransaction < ApplicationRecord
  STATUSES = %w[pending success failed cancelled expired].freeze

  belongs_to :order
  belongs_to :purchase, optional: true

  validates :tx_ref, presence: true, uniqueness: true
  validates :amount_santims, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :amount_decimal, presence: true
  validates :currency, presence: true
  validates :status, presence: true, inclusion: { in: STATUSES }

  scope :pending, -> { where(status: "pending") }
  scope :successful, -> { where(status: "success") }
  scope :failed, -> { where(status: "failed") }
  scope :reconciliation_candidates, ->(window) { pending.where("created_at < ?", window) }
  scope :abandoned_candidates, ->(window) { pending.where("created_at < ?", window) }

  def pending?
    status == "pending"
  end

  def success?
    status == "success"
  end

  def failed?
    status == "failed"
  end

  def cancelled?
    status == "cancelled"
  end

  def expired?
    status == "expired"
  end

  def mark_successful!(verification_data = {})
    update!(
      status: "success",
      chapa_reference: verification_data[:reference] || verification_data["reference"] || chapa_reference,
      charge_decimal: verification_data[:charge] || verification_data["charge"],
      payment_method: verification_data[:payment_method] || verification_data["payment_method"] || payment_method,
      mode: verification_data[:mode] || verification_data["mode"] || mode,
      verified_at: Time.current,
      raw_payload: (raw_payload || {}).merge("verification" => verification_data)
    )
  end

  def mark_failed!(error_msg = nil, raw = {})
    update!(
      status: "failed",
      error_message: error_msg || error_message,
      raw_payload: (raw_payload || {}).merge("failure" => raw)
    )
  end

  def mark_cancelled!
    update!(status: "cancelled")
  end

  def mark_expired!
    update!(status: "expired")
  end
end
