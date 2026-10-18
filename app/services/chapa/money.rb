# frozen_string_literal: true

require "bigdecimal"

module Chapa
  module Money
    class InvalidAmountError < ArgumentError; end

    SANTIMS_PER_BIRR = BigDecimal("100")

    # Converts integer minor units (santims) to a decimal string in Birr with exactly 2 decimal places.
    # Uses BigDecimal to avoid IEEE-754 floating point inaccuracies.
    #
    # @param santims [Integer, String, BigDecimal] Amount in santims (e.g. 10050 -> "100.50")
    # @return [String] Formatted decimal string (e.g. "100.50", "0.01")
    def self.santims_to_birr_string(santims)
      return "0.00" if santims.blank? || santims == 0

      santims_bd = if santims.is_a?(BigDecimal)
        santims
      elsif santims.is_a?(Numeric)
        BigDecimal(santims.to_s)
      elsif santims.is_a?(String)
        cleaned = santims.tr(",", "").strip
        raise InvalidAmountError, "Invalid santims string: #{santims.inspect}" unless valid_numeric_string?(cleaned)
        BigDecimal(cleaned)
      else
        raise InvalidAmountError, "Unsupported santims type: #{santims.class}"
      end

      if santims_bd.negative?
        raise InvalidAmountError, "Amount cannot be negative: #{santims.inspect}"
      end

      birr_bd = santims_bd / SANTIMS_PER_BIRR
      sprintf("%.2f", birr_bd)
    end

    def self.santims_to_birr(santims)
      BigDecimal(santims_to_birr_string(santims))
    end

    # Converts a major unit (Birr) string or numeric into integer minor units (santims).
    # Handles strings with commas (e.g. "1,000.50"), decimal strings, and integers without floats.
    #
    # @param birr [String, Integer, BigDecimal, Numeric] Amount in Birr
    # @return [Integer] Integer amount in santims
    def self.birr_to_santims(birr)
      return 0 if birr.blank?

      birr_bd = if birr.is_a?(BigDecimal)
        birr
      elsif birr.is_a?(Integer)
        BigDecimal(birr.to_s)
      elsif birr.is_a?(Numeric)
        BigDecimal(birr.to_s)
      elsif birr.is_a?(String)
        cleaned = birr.tr(",", "").strip
        raise InvalidAmountError, "Invalid Birr string: #{birr.inspect}" unless valid_numeric_string?(cleaned)
        BigDecimal(cleaned)
      else
        raise InvalidAmountError, "Unsupported Birr type: #{birr.class}"
      end

      if birr_bd.negative?
        raise InvalidAmountError, "Amount cannot be negative: #{birr.inspect}"
      end

      (birr_bd * SANTIMS_PER_BIRR).round.to_i
    end

    def self.valid_numeric_string?(str)
      return false if str.blank?
      # Accepts numbers with optional negative sign and optional decimal point
      /\A-?\d+(\.\d+)?\z/.match?(str)
    end
    private_class_method :valid_numeric_string?
  end
end
