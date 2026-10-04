# frozen_string_literal: true

module Payments
  module ChapaGateway
    def self.client
      Chapa::Client.new
    end
  end
end
