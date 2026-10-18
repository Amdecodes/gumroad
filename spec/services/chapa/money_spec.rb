# frozen_string_literal: true

require "spec_helper"

RSpec.describe Chapa::Money do
  describe ".santims_to_birr_string" do
    it "converts 1 santim to '0.01'" do
      expect(described_class.santims_to_birr_string(1)).to eq("0.01")
    end

    it "converts 100 santims to '1.00'" do
      expect(described_class.santims_to_birr_string(100)).to eq("1.00")
    end

    it "converts 100050 santims to '1000.50'" do
      expect(described_class.santims_to_birr_string(100_050)).to eq("1000.50")
    end

    it "converts 0 santims to '0.00'" do
      expect(described_class.santims_to_birr_string(0)).to eq("0.00")
      expect(described_class.santims_to_birr_string(nil)).to eq("0.00")
    end

    it "converts very large amounts without precision loss" do
      large_santims = 500_000_000_99 # 500,000,000.99 Birr
      expect(described_class.santims_to_birr_string(large_santims)).to eq("500000000.99")
    end

    it "handles string input representing santims" do
      expect(described_class.santims_to_birr_string("25000")).to eq("250.00")
      expect(described_class.santims_to_birr_string("1,000")).to eq("10.00")
    end

    it "raises on negative amount" do
      expect do
        described_class.santims_to_birr_string(-50)
      end.to raise_error(Chapa::Money::InvalidAmountError, /cannot be negative/)
    end

    it "raises on invalid string format" do
      expect do
        described_class.santims_to_birr_string("abc")
      end.to raise_error(Chapa::Money::InvalidAmountError, /Invalid santims string/)
    end
  end

  describe ".birr_to_santims" do
    it "converts '0.01' Birr to 1 santim" do
      expect(described_class.birr_to_santims("0.01")).to eq(1)
    end

    it "converts '1,000.50' Birr with comma thousands separator to 100050 santims" do
      expect(described_class.birr_to_santims("1,000.50")).to eq(100_050)
    end

    it "converts '1000.50' Birr without comma to 100050 santims" do
      expect(described_class.birr_to_santims("1000.50")).to eq(100_050)
    end

    it "converts integer Birr amount to santims" do
      expect(described_class.birr_to_santims(150)).to eq(15_000)
    end

    it "converts 0 or blank Birr to 0 santims" do
      expect(described_class.birr_to_santims(0)).to eq(0)
      expect(described_class.birr_to_santims("")).to eq(0)
      expect(described_class.birr_to_santims(nil)).to eq(0)
    end

    it "converts large amounts accurately" do
      expect(described_class.birr_to_santims("25,000,000.75")).to eq(2_500_000_075)
    end

    it "raises on negative Birr amount" do
      expect do
        described_class.birr_to_santims("-10.00")
      end.to raise_error(Chapa::Money::InvalidAmountError, /cannot be negative/)
    end

    it "raises on invalid string" do
      expect do
        described_class.birr_to_santims("invalid")
      end.to raise_error(Chapa::Money::InvalidAmountError, /Invalid Birr string/)
    end
  end
end
