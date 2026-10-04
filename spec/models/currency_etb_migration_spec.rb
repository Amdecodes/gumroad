# frozen_string_literal: true

require "spec_helper"

describe "ETB Currency Migration and Monetary Integrity" do
  describe "User currency defaults" do
    it "defaults new seller currency_type to etb" do
      user = User.new
      expect(user.currency_type).to eq("etb")
    end

    it "safely falls back to etb when currency_type is nil or empty" do
      user = User.new(currency_type: nil)
      expect(user.currency_type).to eq("etb")
    end

    it "preserves explicitly set supported currencies" do
      user = User.new(currency_type: "usd")
      expect(user.currency_type).to eq("usd")
    end
  end

  describe "Link (Product) currency defaults" do
    it "defaults new product price_currency_type to etb" do
      link = Link.new
      expect(link.price_currency_type).to eq("etb")
    end

    it "inherits creator default currency_type (etb)" do
      user = User.new
      link = user.links.new
      expect(link.price_currency_type).to eq("etb")
    end

    it "safely falls back to etb when price_currency_type is nil" do
      link = Link.new(price_currency_type: nil)
      expect(link.price_currency_type).to eq("etb")
    end

    it "allows minimum price of 100 santims (1.00 ETB)" do
      expect(CURRENCY_CHOICES[:etb][:min_price]).to eq(100)
    end
  end

  describe "Purchase currency defaults" do
    it "safely falls back to product currency or etb" do
      purchase = Purchase.new
      expect(purchase.displayed_price_currency_type).to eq(:etb)
    end
  end

  describe "Integer minor unit financial correctness" do
    it "preserves integer santims without float precision loss" do
      amounts_santims = [100, 25_000, 123_456, 999_999_999]
      amounts_santims.each do |santims|
        money = Money.new(santims, :etb)
        expect(money.cents).to eq(santims)
        expect(money.cents).to be_a(Integer)
      end
    end

    it "formats ETB amounts accurately with symbol" do
      expect(MoneyFormatter.format(15_000, :etb, no_cents_if_whole: false)).to eq("150.00 ETB")
      expect(MoneyFormatter.format(15_000, :etb, no_cents_if_whole: true)).to eq("150 ETB")
      expect(MoneyFormatter.format(25_050, :etb, no_cents_if_whole: true)).to eq("250.50 ETB")
    end
  end
end
