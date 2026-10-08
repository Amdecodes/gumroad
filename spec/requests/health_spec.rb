# frozen_string_literal: true

require "spec_helper"

describe "Health Probes", type: :request do
  describe "GET /up" do
    context "when database and redis are healthy" do
      it "returns 200 OK with plain text response" do
        get "/up"

        expect(response.status).to eq(200)
        expect(response.body).to eq("OK")
      end

      it "returns 200 OK with json status" do
        get "/up", headers: { "Accept" => "application/json" }

        expect(response.status).to eq(200)
        json = response.parsed_body
        expect(json["status"]).to eq("ok")
        expect(json["database"]).to eq("connected")
        expect(json["redis"]).to eq("connected")
      end
    end

    context "when database connection fails" do
      before do
        allow(ActiveRecord::Base.connection).to receive(:execute)
          .with("SELECT 1")
          .and_raise(ActiveRecord::ConnectionNotEstablished.new("Database unreachable"))
      end

      it "returns 503 Service Unavailable" do
        get "/up", headers: { "Accept" => "application/json" }

        expect(response.status).to eq(503)
        json = response.parsed_body
        expect(json["status"]).to eq("service_unavailable")
        expect(json["error"]).to include("Database unreachable")
      end

      it "returns 503 plain text response" do
        get "/up"

        expect(response.status).to eq(503)
        expect(response.body).to include("Service Unavailable")
      end
    end

    context "when redis connection fails" do
      before do
        allow($redis).to receive(:ping)
          .and_raise(Redis::CannotConnectError.new("Redis down"))
      end

      it "returns 503 Service Unavailable" do
        get "/up", headers: { "Accept" => "application/json" }

        expect(response.status).to eq(503)
        json = response.parsed_body
        expect(json["status"]).to eq("service_unavailable")
        expect(json["error"]).to include("Redis down")
      end
    end
  end

  describe "GET /health" do
    it "aliases to the health check endpoint" do
      get "/health", headers: { "Accept" => "application/json" }

      expect(response.status).to eq(200)
      json = response.parsed_body
      expect(json["status"]).to eq("ok")
    end
  end
end
