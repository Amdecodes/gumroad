# frozen_string_literal: true

class ChapaRefund < ApplicationRecord
  STATUSES = %w[initiated processing refunded failed reversed].freeze

  belongs_to :purchase
  belongs_to :chapa_transaction, optional: true

  validates :refund_reference, presence: true, uniqueness: true
  validates :amount_santims, presence: true, numericality: { greater_than: 0 }
  validates :status, presence: true, inclusion: { in: STATUSES }

  scope :initiated, -> { where(status: "initiated") }
  scope :processing, -> { where(status: "processing") }
  scope :refunded, -> { where(status: "refunded") }
  scope :failed, -> { where(status: "failed") }
  scope :reversed, -> { where(status: "reversed") }

  def initiated?
    status == "initiated"
  end

  def processing?
    status == "processing"
  end

  def refunded?
    status == "refunded"
  end

  def failed?
    status == "failed"
  end

  def reversed?
    status == "reversed"
  end
end
