# ArifDrop Subscription Architecture Audit

**Project**: ArifDrop (Gumroad fork for Ethiopia)  
**Date**: October 2026  
**Auditor**: Antigravity Assistant  
**Repository Baseline**: `antiwork/gumroad` (`cc4d616c7`)

---

## 1. Executive Summary

Gumroad’s subscription system is comprehensive, supporting recurring memberships, installment plans, tiered benefits, free trials, churn tracking, and automated reminders.

However, the existing recurring engine is architected around **automatic off-session credit card charging** via Stripe (and PayPal Billing Agreements). In Ethiopia, payment methods like Telebirr, CBE Birr, and local debit cards do not support frictionless off-session merchant-initiated pulls.

This audit:

1. Traces the complete 14-stage subscription lifecycle in Gumroad.
2. Identifies the exact code and architecture changes required for **manual monthly renewal through Chapa**:
   - Customer receives renewal reminder.
   - Customer initiates Chapa payment.
   - Payment is verified.
   - The correct subscription period is extended without losing days.
   - Idempotency guards prevent duplicate payments or webhooks from extending twice.

---

## 2. Complete Subscription Lifecycle Trace

### 2.1 Lifecycle State Machine

```
              [Buyer Checkout]
                     │
                     ▼
         ┌───────────────────────┐
         │     INITIAL CHARGE    │
         │  (Purchase created)   │
         └───────────┬───────────┘
                     │
                     ├──────────────────────────────┐
                     ▼                              ▼
          ┌────────────────────┐         ┌────────────────────┐
          │     FREE TRIAL     │         │   ACTIVE MEMBER    │
          │ (free_trial_ends)  │         │   (alive? = true)  │
          └──────────┬─────────┘         └──────────┬─────────┘
                     │                              │
                     ▼                              │
         ┌───────────────────────┐                  │
         │   RENEWAL REMINDER    │◄─────────────────┘
         │ (Reminder Worker)     │
         └───────────┬───────────┘
                     │
                     ├──────────────────────────────┐
                     ▼ (Auto-charge succeeds)       ▼ (Auto-charge fails)
          ┌────────────────────┐         ┌────────────────────┐
          │  EXTENDED PERIOD   │         │    GRACE PERIOD    │
          │ (succeeded_at + P) │         │ (5 days: ALLOWED)  │
          └────────────────────┘         └──────────┬─────────┘
                                                    │
                                     ┌──────────────┴──────────────┐
                                     ▼ (Recovers)                  ▼ (Unresolved)
                          ┌────────────────────┐        ┌────────────────────┐
                          │     RECOVERED      │        │    UNSUBSCRIBE     │
                          │   (alive? = true)  │        │   (failed_at = T)  │
                          └────────────────────┘        └──────────┬─────────┘
                                                                   │
                                                                   ▼
                                                        ┌────────────────────┐
                                                        │   DEACTIVATED      │
                                                        │ (deactivated_at)   │
                                                        │  Access Revoked    │
                                                        └────────────────────┘
```

---

### 2.2 Stage-by-Stage Implementation Details

| Stage                            | Description                                                                                         | Key Code & File References                                                                                                                                                    |
| :------------------------------- | :-------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Creation**                  | Subscription record initialized when purchasing a recurring product (`Link#is_recurring_billing?`). | `app/models/subscription.rb:build_purchase`, `Order::ChargeService:61`                                                                                                        |
| **2. Initial Payment**           | First installment charged via checkout.                                                             | `Order::ChargeService.perform`, `CreditCard.create`                                                                                                                           |
| **3. Activation**                | `original_purchase` is stamped `:successful`, subscription marked active.                           | `Subscription#original_purchase`, `Subscription#alive?` (`cancelled_at.nil? && failed_at.nil?`)                                                                               |
| **4. Recurring Billing**         | Scheduled Sidekiq worker runs at the end of the paid period.                                        | `RecurringChargeWorker` (`app/sidekiq/recurring_charge_worker.rb`), scheduled via `Subscription#schedule_charge`                                                              |
| **5. Renewal**                   | Auto-charge captures funds and extends the subscription period.                                     | `Subscription#charge!(off_session: true)` creates a new child `Purchase`                                                                                                      |
| **6. Grace Period**              | A 5-day window where the subscriber retains access while failed payments are retried.               | `Subscription::ALLOWED_TIME_BEFORE_FAIL_AND_UNSUBSCRIBE = 5.days` (`app/models/subscription.rb:25`)                                                                           |
| **7. Failed Payment**            | First failure triggers warning email and schedules retries.                                         | `ChargeDeclinedReminderWorker` (`app/sidekiq/charge_declined_reminder_worker.rb`), `CustomerLowPriorityMailer.subscription_card_declined`                                     |
| **8. Cancellation**              | Can be initiated by buyer or seller. Cancels at end of billing cycle or immediately.                | `Subscription#cancel!` (`app/models/subscription.rb:985`), `Subscription#cancel_effective_immediately!`                                                                       |
| **9. Expiration & Deactivation** | Once `failed_at` or `cancelled_at` passes, background worker marks deactivation.                    | `FindExpiredSubscriptionsToSetAsDeactivatedWorker` (`app/sidekiq/find_expired_subscriptions_to_set_as_deactivated_worker.rb:10-12`), `Subscription#deactivate!` (`line 1007`) |
| **10. Access Control**           | Content gates check subscription validity before serving downloads, streams, or posts.              | `Subscription#grant_access_to_product?` (`app/models/subscription.rb:163`), `Subscription#alive?` (`line 141`)                                                                |
| **11. Emails & Reminders**       | System notifies users before renewal, upon failure, and upon cancellation.                          | `RecurringChargeReminderWorker` (`app/sidekiq/recurring_charge_reminder_worker.rb`), `CustomerLowPriorityMailer.subscription_renewal_reminder`                                |
| **12. Jobs & Schedulers**        | Background jobs manage execution, expiration, and tier synchronization.                             | `ExecuteScheduledPayoutsJob`, `UpdateIntegrationsOnTierChangeWorker`, `CancelSubscriptionsForProductWorker`                                                                   |
| **13. Webhooks**                 | Outbound pings notify creator endpoints of subscription state changes.                              | `Subscription#send_cancelled_notification_webhook`, `PostToPingEndpointsWorker` (`ResourceSubscription::SUBSCRIPTION_ENDED_RESOURCE_NAME`)                                    |
| **14. Receipts & Invoices**      | Automatic VAT-compliant receipt generated for each charge.                                          | `SendPurchaseReceiptJob` (`app/sidekiq/send_purchase_receipt_job.rb`), `InvoicesController` (`app/controllers/purchases/invoices_controller.rb`)                              |

---

## 3. The Core Challenge: Automatic vs Manual Renewal

### 3.1 Existing Automatic Flow (Stripe/Card)

In `app/sidekiq/recurring_charge_worker.rb:101`:

```ruby
# Locked via SuoSemaphore
subscription.charge!(override_params:)
```

This assumes:

1. `subscription.credit_card_to_charge` is valid and vaulted with a card processor.
2. The card can be charged **off-session** without user intervention (`off_session: true`).
3. If it succeeds, `last_successful_not_reversed_or_refunded_charge.succeeded_at` is updated to `Time.current`, which moves `end_time_of_last_paid_period` forward by 1 period.

### 3.2 Required ArifDrop Flow (Manual Monthly Chapa Renewal)

For Ethiopia, subscriptions must operate as **prepaid recurring cycles with manual invoice checkout**:

1. **Reminder**: 3 to 5 days before expiration, customer receives an SMS / email reminder with a secure payment link.
2. **Payment**: Customer opens link, chooses Chapa (Telebirr, CBE Birr, Awash, or Card), and completes payment.
3. **Verification**: Chapa webhook arrives, payment is verified.
4. **Period Extension**: The subscription is extended from the **prior expiration date**, NOT from the payment timestamp.
5. **Idempotency**: Prevent double extensions if webhook fires multiple times or user also hits return URL.

---

## 4. Exact Code Adaptation Blueprint for Chapa Manual Renewal

### Step 1: Renewal Reminder Worker & Payment Link

**Current Code**: `Subscription#schedule_renewal_reminder` in `app/models/subscription.rb:916`

```ruby
def schedule_renewal_reminder
  return unless send_renewal_reminders?
  RecurringChargeReminderWorker.perform_at(send_renewal_reminder_at, id)
end
```

**Adaptation Required**:

- Enable renewal reminders unconditionally for all active Chapa subscriptions.
- In `CustomerLowPriorityMailer.subscription_renewal_reminder`, generate a signed renewal URL:
  `UrlService.domain_with_protocol + "/subscriptions/#{subscription.external_id}/renew?token=#{subscription.generate_renewal_token}"`
- If customer has phone number, enqueue SMS reminder via domestic SMS gateway (Ethio Telecom / Safaricom).

---

### Step 2: Disable Automatic Background Card Charging

**Current Code**: `RecurringChargeWorker#perform` (`app/sidekiq/recurring_charge_worker.rb:101`)

```ruby
subscription.charge!(override_params:)
```

**Adaptation Required**:

- If `subscription.payment_method == "chapa"` or `subscription.manual_renewal?`:
  - Do **NOT** attempt an off-session card charge (which will fail).
  - Instead, check if `overdue_for_charge?`.
  - If overdue beyond grace period (`seconds_overdue_for_charge > ALLOWED_TIME_BEFORE_FAIL_AND_UNSUBSCRIBE`), call `subscription.unsubscribe_and_fail!`.
  - If within grace period, re-send final grace-period reminder notice.

---

### Step 3: Renewal Initiation Controller & Route

**New Action**: `SubscriptionsController#renew` (`app/controllers/subscriptions_controller.rb`)

- Resolves subscription by token or authenticated buyer.
- Creates an `in_progress` renewal `Purchase` linked to `subscription.id`.
- Initiates Chapa transaction with unique `tx_ref`:
  `tx_ref: "sub_renew_#{subscription.id}_cycle_#{subscription.purchases.count + 1}_#{SecureRandom.hex(4)}"`
- Redirects buyer to Chapa checkout.

---

### Step 4: Correct Subscription Period Extension Logic

**Current Flaw in Gumroad**:
In `app/models/subscription.rb:1234-1236`:

```ruby
def end_time_of_last_paid_period
  if last_successful_not_reversed_or_refunded_charge_at.present?
    last_successful_not_reversed_or_refunded_charge_at + period
  else
    free_trial_ends_at
  end
end
```

`last_successful_not_reversed_or_refunded_charge_at` looks ONLY at the single latest purchase's `succeeded_at` timestamp.

- **Problem**: If a subscriber's current month ends on **October 31**, and they pay their renewal early on **October 25**, setting `succeeded_at = October 25` means their subscription would expire on **November 25**, cheating them out of 6 days!
- **Solution**: The renewal extension must anchor to the current subscription end date:
  ```ruby
  def calculate_next_period_end
    current_end = [end_time_of_subscription, Time.current].max
    current_end + period
  end
  ```
  And when stamping the renewal purchase, record `covered_period_start` and `covered_period_end` on the `Purchase` record, or set the renewal purchase's effective reference date.

---

### Step 5: Webhook & Duplicate Payment Protection (Idempotency)

To guarantee a webhook and a user return redirect cannot extend a subscription twice:

1. **Database Uniqueness Constraint**:
   Store `chapa_tx_ref` in `ProcessorPaymentIntent#intent_id` (which has a unique database index) or a dedicated `chapa_transaction_reference` column on `purchases`.
2. **Pessimistic Locking**:
   In the renewal handler:

   ```ruby
   subscription.with_lock do
     # 1. Check if this exact Chapa transaction was already processed
     return if Purchase.where(processor_payment_intent_id: chapa_tx_ref, purchase_state: :successful).exists?

     # 2. Check if a renewal was already applied for this cycle
     if subscription.end_time_of_subscription > target_cycle_cutoff
       Rails.logger.warn("Subscription #{subscription.id} already extended for this cycle.")
       return
     end

     # 3. Finalize the renewal purchase
     purchase.update!(purchase_state: :successful, succeeded_at: target_cycle_anchor)
     subscription.update!(failed_at: nil) # Clear any grace-period flags
   end
   ```

3. **Webhook Verification**:
   The webhook endpoint in `ForeignWebhooksController` must verify the Chapa signature hash using `CHAPA_WEBHOOK_SECRET` before passing payload to worker.

---

## 5. Summary of Affected Files

| Component                   | File Path                                         | Modification Required                                                                                      |
| :-------------------------- | :------------------------------------------------ | :--------------------------------------------------------------------------------------------------------- |
| **Subscription Model**      | `app/models/subscription.rb`                      | Update `end_time_of_last_paid_period` to anchor renewals to previous period end; add manual renewal flags. |
| **Recurring Worker**        | `app/sidekiq/recurring_charge_worker.rb`          | Branch Chapa manual subscriptions away from off-session charge into grace-period monitor.                  |
| **Renewal Reminder Worker** | `app/sidekiq/recurring_charge_reminder_worker.rb` | Generate direct Chapa payment link in renewal emails/SMS.                                                  |
| **Checkout Controller**     | `app/controllers/subscriptions_controller.rb`     | Add customer renewal initiation endpoint.                                                                  |
| **Foreign Webhook**         | `app/controllers/foreign_webhooks_controller.rb`  | Add Chapa webhook receiver and idempotency check.                                                          |
| **Customer Mailer**         | `app/mailers/customer_low_priority_mailer.rb`     | Include Chapa payment button and Telebirr/CBE payment instructions.                                        |
