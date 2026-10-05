# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Security: Rate Limiting & Abuse Prevention", type: :request do
  def reset_rack_attack!
    Rack::Attack.cache.store.flushdb
    Rack::Attack.reset!
  end

  before { reset_rack_attack! }
  after { reset_rack_attack! }

  describe "Rack::Attack Throttling Configuration" do
    let(:remote_ip) { "198.51.100.42" }

    def make_order_request(ip: remote_ip, email: "buyer@example.com")
      Rack::Attack::Request.new(
        Rack::MockRequest.env_for(
          "/orders",
          method: "POST",
          input: { email: }.to_json,
          "CONTENT_TYPE" => "application/json",
          "HTTP_CF_CONNECTING_IP" => ip
        )
      )
    end

    def make_renew_request(ip: remote_ip)
      Rack::Attack::Request.new(
        Rack::MockRequest.env_for(
          "/subscriptions/sub_test_123/renew",
          method: "POST",
          input: "",
          "HTTP_CF_CONNECTING_IP" => ip
        )
      )
    end

    def make_webhook_request(ip: remote_ip)
      Rack::Attack::Request.new(
        Rack::MockRequest.env_for(
          "/webhooks/chapa",
          method: "POST",
          input: {}.to_json,
          "CONTENT_TYPE" => "application/json",
          "HTTP_CF_CONNECTING_IP" => ip
        )
      )
    end

    describe "POST /orders IP throttling" do
      it "allows up to 20 requests per minute and throttles the 21st request" do
        travel_to(Time.current) do
          20.times do |i|
            request = make_order_request(ip: "198.51.100.50", email: "user#{i}@example.com")
            expect(Rack::Attack.configuration.throttled?(request)).to be(false), "Request #{i + 1} was unexpectedly throttled"
          end

          over_limit_request = make_order_request(ip: "198.51.100.50", email: "user_over@example.com")
          expect(Rack::Attack.configuration.throttled?(over_limit_request)).to be(true)
        end
      end
    end

    describe "POST /orders email throttling" do
      it "throttles by target buyer email across rotating IPs after 20 attempts" do
        travel_to(Time.current) do
          target_email = "victim_buyer@example.com"

          20.times do |i|
            request = make_order_request(ip: "198.51.100.#{100 + i}", email: target_email)
            expect(Rack::Attack.configuration.throttled?(request)).to be(false), "Request #{i + 1} was unexpectedly throttled"
          end

          over_limit_request = make_order_request(ip: "198.51.100.250", email: target_email)
          expect(Rack::Attack.configuration.throttled?(over_limit_request)).to be(true)
        end
      end
    end

    describe "POST /subscriptions/:id/renew IP throttling" do
      it "allows up to 20 renewal requests per minute and throttles the 21st" do
        travel_to(Time.current) do
          20.times do |i|
            request = make_renew_request(ip: "198.51.100.60")
            expect(Rack::Attack.configuration.throttled?(request)).to be(false), "Request #{i + 1} was unexpectedly throttled"
          end

          over_limit_request = make_renew_request(ip: "198.51.100.60")
          expect(Rack::Attack.configuration.throttled?(over_limit_request)).to be(true)
        end
      end
    end

    describe "POST /webhooks/chapa IP burst throttling" do
      it "allows high volume bursts up to 120 webhooks per minute and throttles subsequent requests" do
        travel_to(Time.current) do
          120.times do |i|
            request = make_webhook_request(ip: "198.51.100.70")
            expect(Rack::Attack.configuration.throttled?(request)).to be(false), "Webhook #{i + 1} was unexpectedly throttled"
          end

          over_limit_webhook = make_webhook_request(ip: "198.51.100.70")
          expect(Rack::Attack.configuration.throttled?(over_limit_webhook)).to be(true)
        end
      end
    end

    describe "Throttled Responder" do
      it "returns 429 Too Many Requests with Retry-After header and JSON body" do
        mock_env = Rack::MockRequest.env_for("/orders", method: "POST", "CONTENT_TYPE" => "application/json")
        mock_env["rack.attack.match_data"] = { epoch_time: Time.current.to_i, period: 60, limit: 20 }
        request = Rack::Attack::Request.new(mock_env)

        status, headers, body = Rack::Attack.throttled_responder.call(request)

        expect(status).to eq(429)
        expect(headers["Retry-After"]).to be_present
        expect(headers["Content-Type"]).to eq("application/json")

        parsed_body = JSON.parse(body.first)
        expect(parsed_body["error"]).to eq("Too Many Requests")
        expect(parsed_body["message"]).to include("Rate limit exceeded")
      end
    end
  end
end
