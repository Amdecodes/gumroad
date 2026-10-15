# frozen_string_literal: true

class DiscoverDomainConstraint
  def self.matches?(request)
    request.host == VALID_DISCOVER_REQUEST_HOST || request.host == "127.0.0.1"
  end
end
