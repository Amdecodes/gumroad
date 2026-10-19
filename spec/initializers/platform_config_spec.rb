# frozen_string_literal: true

require "spec_helper"

RSpec.describe PlatformConfig do
  describe ".validate_production_config!" do
    let(:prod_env) { ActiveSupport::StringInquirer.new("production") }
    let(:staging_env) { ActiveSupport::StringInquirer.new("staging") }
    let(:test_env) { ActiveSupport::StringInquirer.new("test") }
    let(:dev_env) { ActiveSupport::StringInquirer.new("development") }

    describe "CHAPA_API_URL host allowlist" do
      context "outside test/dev" do
        it "fails boot when CHAPA_API_URL is configured to an untrusted host" do
          allow(ENV).to receive(:[]).and_call_original
          allow(ENV).to receive(:[]).with("CHAPA_API_URL").and_return("https://evil.host/v1")

          expect do
            described_class.validate_production_config!(staging_env)
          end.to raise_error(
            RuntimeError,
            "Security boot failure: CHAPA_API_URL outside test/dev must only be https://api.chapa.co/v1. Received: https://evil.host/v1"
          )
        end

        it "fails boot when CHAPA_API_URL is missing the /v1 path prefix" do
          allow(ENV).to receive(:[]).and_call_original
          allow(ENV).to receive(:[]).with("CHAPA_API_URL").and_return("https://api.chapa.co")

          expect do
            described_class.validate_production_config!(staging_env)
          end.to raise_error(
            RuntimeError,
            "Security boot failure: CHAPA_API_URL outside test/dev must only be https://api.chapa.co/v1. Received: https://api.chapa.co"
          )
        end

        it "fails boot in production environment before checking missing production keys" do
          allow(ENV).to receive(:[]).and_call_original
          allow(ENV).to receive(:[]).with("CHAPA_API_URL").and_return("https://untrusted.chapa.co/v1")

          expect do
            described_class.validate_production_config!(prod_env)
          end.to raise_error(
            RuntimeError,
            "Security boot failure: CHAPA_API_URL outside test/dev must only be https://api.chapa.co/v1. Received: https://untrusted.chapa.co/v1"
          )
        end

        it "permits exactly https://api.chapa.co/v1" do
          allow(ENV).to receive(:[]).and_call_original
          allow(ENV).to receive(:[]).with("CHAPA_API_URL").and_return("https://api.chapa.co/v1")

          expect do
            described_class.validate_production_config!(staging_env)
          end.not_to raise_error
        end

        it "permits https://api.chapa.co/v1 with a trailing slash" do
          allow(ENV).to receive(:[]).and_call_original
          allow(ENV).to receive(:[]).with("CHAPA_API_URL").and_return("https://api.chapa.co/v1/")

          expect do
            described_class.validate_production_config!(staging_env)
          end.not_to raise_error
        end

        it "permits unset CHAPA_API_URL outside test/dev (defaults to allowlisted production URL)" do
          allow(ENV).to receive(:[]).and_call_original
          allow(ENV).to receive(:[]).with("CHAPA_API_URL").and_return(nil)
          allow(GlobalConfig).to receive(:get).with("CHAPA_API_URL").and_return(nil)

          expect do
            described_class.validate_production_config!(staging_env)
          end.not_to raise_error
        end
      end

      context "inside test/dev" do
        it "permits arbitrary CHAPA_API_URL in test environment" do
          allow(ENV).to receive(:[]).and_call_original
          allow(ENV).to receive(:[]).with("CHAPA_API_URL").and_return("http://localhost:9999/v1")

          expect do
            described_class.validate_production_config!(test_env)
          end.not_to raise_error
        end

        it "permits arbitrary CHAPA_API_URL in development environment" do
          allow(ENV).to receive(:[]).and_call_original
          allow(ENV).to receive(:[]).with("CHAPA_API_URL").and_return("http://localhost:9999/v1")

          expect do
            described_class.validate_production_config!(dev_env)
          end.not_to raise_error
        end
      end
    end
  end
end
