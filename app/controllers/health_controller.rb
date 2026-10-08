# frozen_string_literal: true

class HealthController < ActionController::Base
  def show
    ActiveRecord::Base.connection.execute("SELECT 1")
    $redis.ping

    respond_to do |format|
      format.json do
        render json: {
          status: "ok",
          database: "connected",
          redis: "connected"
        }, status: :ok
      end
      format.all do
        render plain: "OK", status: :ok
      end
    end
  rescue StandardError => e
    Rails.logger.error("Health probe failed: #{e.class} - #{e.message}")

    respond_to do |format|
      format.json do
        render json: {
          status: "service_unavailable",
          error: e.message
        }, status: :service_unavailable
      end
      format.all do
        render plain: "Service Unavailable: #{e.message}", status: :service_unavailable
      end
    end
  end
end
