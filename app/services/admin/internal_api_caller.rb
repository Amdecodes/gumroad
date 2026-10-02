# frozen_string_literal: true

class Admin::InternalApiCaller
  Result = Struct.new(:status, :body, :data, keyword_init: true) do
    def success?
      status.between?(200, 299) && (data.blank? || data.fetch("success", false) == true)
    end

    def error_message
      data&.fetch("message", nil) || "An unexpected error occurred."
    end
  end

  def self.call(admin_user:, method:, path:, params: {})
    new(admin_user:).call(method:, path:, params:)
  end

  def initialize(admin_user:)
    raise ArgumentError, "Admin user must be an authorized team member" unless admin_user&.is_team_member?

    @admin_user = admin_user
  end

  def call(method:, path:, params: {})
    token_plaintext, admin_api_token = AdminApiToken.mint_with_plaintext!(
      actor_user_id: @admin_user.id,
      expires_at: 5.minutes.from_now
    )

    api_host = VALID_API_REQUEST_HOSTS.first || "api.gumroad.com"
    request_method = method.to_s.upcase
    body_input = params.present? ? params.to_json : ""

    env_options = {
      method: request_method,
      "HTTP_HOST" => api_host,
      "HTTP_AUTHORIZATION" => "Bearer #{token_plaintext}",
      "HTTP_ACCEPT" => "application/json",
      "CONTENT_TYPE" => "application/json"
    }
    env_options[:input] = body_input if body_input.present?

    env = Rack::MockRequest.env_for("https://#{api_host}#{path}", **env_options)

    status, _headers, body = Rails.application.call(env)
    body_content = body.respond_to?(:body) ? body.body : body.to_a.join
    data = begin
      JSON.parse(body_content)
    rescue JSON::ParserError
      {}
    end

    Result.new(status:, body: body_content, data:)
  ensure
    admin_api_token&.update_columns(revoked_at: Time.current)
  end
end
