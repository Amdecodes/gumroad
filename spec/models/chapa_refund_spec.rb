# frozen_string_literal: true

require "spec_helper"

describe ChapaRefund do
  let(:seller) { create(:user) }
  let(:product) { create(:product, user: seller, price_cents: 100_00, price_currency_type: "etb") }
  let(:purchase) { create(:purchase, link: product, seller:, price_cents: 100_00) }

  subject do
    described_class.new(
      purchase:,
      amount_santims: 100_00,
      refund_reference: "rf_chp_#{purchase.id}_1",
      status: "initiated"
    )
  end

  describe "validations" do
    it "is valid with valid attributes" do
      expect(subject).to be_valid
    end

    it "requires refund_reference" do
      subject.refund_reference = nil
      expect(subject).not_to be_valid
      expect(subject.errors[:refund_reference]).to be_present
    end

    it "enforces uniqueness of refund_reference" do
      subject.save!
      duplicate = described_class.new(
        purchase:,
        amount_santims: 50_00,
        refund_reference: subject.refund_reference,
        status: "initiated"
      )
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:refund_reference]).to include("has already been taken")
    end

    it "requires amount_santims greater than 0" do
      subject.amount_santims = 0
      expect(subject).not_to be_valid
      expect(subject.errors[:amount_santims]).to be_present

      subject.amount_santims = -100
      expect(subject).not_to be_valid
      expect(subject.errors[:amount_santims]).to be_present
    end

    it "validates status inclusion" do
      subject.status = "invalid_status"
      expect(subject).not_to be_valid
      expect(subject.errors[:status]).to be_present

      ChapaRefund::STATUSES.each do |valid_status|
        subject.status = valid_status
        expect(subject).to be_valid
      end
    end
  end

  describe "associations" do
    it "belongs to purchase" do
      expect(subject.purchase).to eq(purchase)
    end

    it "optionally belongs to chapa_transaction" do
      expect(subject.chapa_transaction).to be_nil
      expect(subject).to be_valid
    end
  end

  describe "scopes" do
    before { subject.save! }

    it "filters by status" do
      refunded = described_class.create!(
        purchase:,
        amount_santims: 50_00,
        refund_reference: "rf_chp_#{purchase.id}_2",
        status: "refunded"
      )
      failed = described_class.create!(
        purchase:,
        amount_santims: 20_00,
        refund_reference: "rf_chp_#{purchase.id}_3",
        status: "failed"
      )

      expect(described_class.initiated).to include(subject)
      expect(described_class.initiated).not_to include(refunded, failed)
      expect(described_class.refunded).to include(refunded)
      expect(described_class.failed).to include(failed)
    end
  end

  describe "status helper predicates" do
    it "correctly identifies status" do
      subject.status = "initiated"
      expect(subject.initiated?).to be true
      expect(subject.refunded?).to be false

      subject.status = "refunded"
      expect(subject.refunded?).to be true
      expect(subject.failed?).to be false

      subject.status = "failed"
      expect(subject.failed?).to be true

      subject.status = "reversed"
      expect(subject.reversed?).to be true

      subject.status = "processing"
      expect(subject.processing?).to be true
    end
  end
end
