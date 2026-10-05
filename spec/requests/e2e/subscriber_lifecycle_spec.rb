# frozen_string_literal: true

require "spec_helper"

RSpec.describe "E2E: Recurring Subscriber Lifecycle", type: :request do
  let(:seller) { create(:named_seller) }
  let(:subscriber) { create(:user) }
  let(:product) { create(:membership_product, subscription_duration: "monthly", user: seller, price_currency_type: "etb", block_access_after_membership_cancellation: true) }
  let(:secret_key) { "TEST_CHAPA_WEBHOOK_SECRET_SUB" }

  before do
    host! DOMAIN
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with("CHAPA_WEBHOOK_SECRET").and_return(secret_key)
    allow(ENV).to receive(:[]).with("CHAPA_SECRET_KEY").and_return("TEST_SECRET_KEY")
  end

  def compute_signature(body)
    OpenSSL::HMAC.hexdigest("SHA256", secret_key, body)
  end

  it "manages the recurring lifecycle: initial purchase -> reminder -> grace period -> manual renewal" do
    # 1. Initial subscription creation
    start_time = Time.zone.parse("2026-10-01 10:00:00")
    subscription = nil
    original_purchase = nil

    travel_to(start_time) do
      subscription = create(:subscription, link: product, user: subscriber)
      original_purchase = create(
        :purchase,
        link: product,
        seller:,
        subscription:,
        is_original_subscription_purchase: true,
        purchase_state: "successful",
        succeeded_at: Time.current,
        price_cents: 25000,
        displayed_price_cents: 25000,
        displayed_price_currency_type: "etb",
        charge_processor_id: "chapa"
      )
    end

    expect(subscription.alive?).to be true
    expect(subscription.grant_access_to_product?).to be true
    initial_period_end = subscription.end_time_of_subscription
    expect(initial_period_end).to be > start_time

    # 2. Fast-forward to 2 days before expiration: reminder notification
    travel_to(initial_period_end - 2.days) do
      expect(subscription.renewal_due?).to be true
      expect do
        perform_enqueued_jobs do
          SubscriptionRenewalNotifierWorker.new.perform
        end
      end.to change { ActionMailer::Base.deliveries.count }.by(1)

      reminder_mail = ActionMailer::Base.deliveries.last
      expect(reminder_mail.to).to include(subscriber.email)
    end

    # 3. Fast-forward to 2 days past expiration (within 5-day grace period)
    travel_to(initial_period_end + 2.days) do
      expect(subscription.overdue_for_charge?).to be true
      expect(subscription.in_grace_period?).to be true
      expect(subscription.grant_access_to_product?).to be true

      # 4. Subscriber initiates renewal via Chapa
      subscription.update!(token: "renew_token_abc", token_expires_at: 1.day.from_now)
      allow_any_instance_of(Chapa::Client).to receive(:initialize_transaction) do |_instance, args|
        {
          success: true,
          tx_ref: args[:tx_ref],
          checkout_url: "https://checkout.chapa.co/checkout/payment/CHAPA_RENEW_123"
        }
      end

      post "/subscriptions/#{subscription.external_id}/renew",
           params: { token: "renew_token_abc" },
           as: :json

      expect(response).to have_http_status(:ok)
      res_json = JSON.parse(response.body)
      expect(res_json["checkout_url"]).to eq("https://checkout.chapa.co/checkout/payment/CHAPA_RENEW_123")
      renewal_tx_ref = res_json["tx_ref"]
      expect(renewal_tx_ref).to be_present

      renewal_purchase = Purchase.find_by_processor_transaction_id(renewal_tx_ref)
      expect(renewal_purchase).to be_present
      expect(renewal_purchase.in_progress?).to be true
      expect(renewal_purchase.price_in_currency_cents).to eq(25000)

      # 5. Webhook confirmation of renewal payment
      webhook_payload = {
        event: "charge.complete",
        tx_ref: renewal_tx_ref,
        status: "success"
      }.to_json

      signature = compute_signature(webhook_payload)

      allow_any_instance_of(Chapa::Client).to receive(:verify_transaction).with(renewal_tx_ref).and_return({
                                                                                                             success: true,
                                                                                                             status: "success",
                                                                                                             amount: 250.0,
                                                                                                             currency: "ETB",
                                                                                                             reference: "chapa_renew_ref_001"
                                                                                                           })

      post "/webhooks/chapa", params: webhook_payload, headers: {
        "CONTENT_TYPE" => "application/json",
        "Chapa-Signature" => signature
      }

      expect(response).to have_http_status(:ok)
      renewal_purchase.reload
      expect(renewal_purchase.successful?).to be true

      # 6. Verify period extends continuously from prior cycle end date
      subscription.reload
      expect(subscription.alive?).to be true
      expect(subscription.end_time_of_subscription).to be > initial_period_end
    end
  end

  it "deactivates and revokes access when grace period expires without payment" do
    start_time = Time.zone.parse("2026-10-01 10:00:00")
    subscription = nil

    travel_to(start_time) do
      subscription = create(:subscription, link: product, user: subscriber)
      create(
        :purchase,
        link: product,
        seller:,
        subscription:,
        is_original_subscription_purchase: true,
        purchase_state: "successful",
        succeeded_at: Time.current,
        price_cents: 25000,
        displayed_price_cents: 25000,
        displayed_price_currency_type: "etb",
        charge_processor_id: "chapa"
      )
    end

    expiration_time = subscription.end_time_of_subscription

    # Fast forward 6 days past expiration (past the 5-day grace period)
    travel_to(expiration_time + 6.days) do
      expect(subscription.overdue_for_charge?).to be true
      expect(subscription.in_grace_period?).to be false

      SubscriptionGracePeriodWorker.new.perform

      subscription.reload
      expect(subscription.alive?).to be false
      expect(subscription.deactivated_at).to be_present
      expect(subscription.failed_at).to be_present
      expect(subscription.grant_access_to_product?).to be false
    end
  end
end
