# ArifDrop Payment Architecture Audit

**Project**: ArifDrop (Gumroad fork for Ethiopia)  
**Date**: October 2026  
**Auditor**: Antigravity Assistant  
**Repository Baseline**: `antiwork/gumroad` (`cc4d616c7`)

---

## 1. Executive Summary

Gumroad’s payment architecture is built around an enterprise-grade multi-seller, multi-currency processing pipeline. However, its charging, vaulting, webhook processing, and payout layers are deeply coupled to **Stripe** (PaymentIntents, SetupIntents, Connect accounts, Radar, Apple Pay) and **PayPal** (Billing Agreements, Commerce Platform).

To adapt Gumroad for Ethiopia with **Chapa** and **ETB**:

1. A new `ChapaChargeProcessor` must be created within `app/business/payments/charging/implementations/chapa/`.
2. The checkout flow must support Chapa’s hosted redirect / popup checkout modal and server-to-server webhook confirmation.
3. ETB must be promoted from an unlisted secondary currency to an active primary currency in `config/currencies.json`.
4. Payouts must initially run via manual admin batch export / execution for domestic Ethiopian rails (Telebirr, CBE Birr, Awash, etc.).

---

## 2. Core Payment Models

Gumroad uses distinct naming conventions that are critical to understand:

| Model                        | File Path                                | Role in Architecture                                                                                                                                                                                                                                                                    |
| :--------------------------- | :--------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`Order`**                  | `app/models/order.rb`                    | High-level checkout container grouping one or more line items from a single buyer session. Generates secure external confirmation tokens (`scope: "confirm"`).                                                                                                                          |
| **`Charge`**                 | `app/models/charge.rb`                   | The processor-level transaction entity representing funds captured from the buyer for a specific seller. Has prefix `CH-` (`COMBINED_CHARGE_PREFIX`). One `Order` can have multiple `Charges` if items span multiple sellers.                                                           |
| **`Purchase`**               | `app/models/purchase.rb`                 | The core domain entity representing an individual item bought (or a subscription installment). Tracks lifecycle states: `in_progress`, `successful`, `failed`, `refunded`, `chargedback`. Stores money in integer cents (`price_cents`, `gumroad_fee_cents`, `affiliate_credit_cents`). |
| **`ProcessorPaymentIntent`** | `app/models/processor_payment_intent.rb` | Bridges `Purchase` to third-party processor intent objects (e.g. Stripe `pi_...`).                                                                                                                                                                                                      |
| **`ProcessedStripeEvent`**   | `app/models/processed_stripe_event.rb`   | Webhook idempotency registry. Ensures incoming processor webhook IDs are never processed more than once.                                                                                                                                                                                |
| **`Balance`**                | `app/models/balance.rb`                  | Tracks a creator's unsettled and payable balance segregated by `merchant_account_id` and `holding_currency`.                                                                                                                                                                            |
| **`BalanceTransaction`**     | `app/models/balance_transaction.rb`      | Immutable ledger entry recording every balance change (positive for gross sales, negative for platform fees, payouts, refunds, and chargebacks).                                                                                                                                        |
| **`Payment`**                | `app/models/payment.rb`                  | **IMPORTANT**: In Gumroad, `Payment` refers to a **Payout to a Creator**, NOT a buyer charge! States: `creating`, `processing`, `unclaimed`, `completed`, `failed`, `cancelled`, `reversed`, `returned`.                                                                                |
| **`ScheduledPayout`**        | `app/models/scheduled_payout.rb`         | Represents a queued periodic or admin-scheduled payout batch for a seller.                                                                                                                                                                                                              |
| **`Refund`**                 | `app/models/refund.rb`                   | Records full or partial refund events, tracks `processor_refund_id`, and manages fee recovery.                                                                                                                                                                                          |
| **`CreditCard`**             | `app/models/credit_card.rb`              | Vaulted payment token (`token`, `fingerprint`, `processor_payment_method_id`) used for recurring charges.                                                                                                                                                                               |
| **`MerchantAccount`**        | `app/models/merchant_account.rb`         | Manages seller payment credentials (Stripe Connect account, PayPal account, or platform merchant account).                                                                                                                                                                              |

---

## 3. Existing Payment Processors & Abstraction Layer

The processor abstraction lives in `app/business/payments/charging/`:

### 3.1 Base Architecture

- **`ChargeProcessor`** (`app/business/payments/charging/charge_processor.rb`):  
  The registry and interface defining standard methods:
  - `get_chargeable_for_params(params, guid)`
  - `get_chargeable_for_data(...)`
  - `get_charge(charge_processor_id, charge_id)`
  - `search_charge(charge_processor_id:, purchase:)`
  - `get_charge_intent(merchant_account, payment_intent_id)`
  - `get_setup_intent(merchant_account, setup_intent_id)`

### 3.2 Registered Implementations

1. **`StripeChargeProcessor`** (`app/business/payments/charging/implementations/stripe/stripe_charge_processor.rb`): Primary processor for credit/debit cards, Apple Pay, Google Pay, 3D Secure SCA.
2. **`PaypalChargeProcessor`** (`app/business/payments/charging/implementations/paypal/paypal_charge_processor.rb`): Handles PayPal orders and billing agreements.
3. **`BraintreeChargeProcessor`** (`app/business/payments/charging/implementations/braintree/braintree_charge_processor.rb`): Legacy/secondary card & PayPal vaulting.

---

## 4. End-to-End Checkout & Purchase Flow

```
[Buyer Cart / Product Page]
           │
           ▼
[POST /orders (OrdersController#create or #prepare)]
           │
           ├─► Order::CreateService.perform
           │     └─► Creates Order & Purchase rows (status: :in_progress)
           │
           ├─► Order::ChargeService.perform OR Order::PreparePaymentIntentService
           │     ├─► Groups purchases by seller
           │     ├─► Creates Charge record (e.g. "CH-xxxx")
           │     └─► Calls ChargeProcessor (Stripe PaymentIntent / SetupIntent)
           │
           ▼
[Payment Confirmation]
           │
           ├─► Frontend 3DS / SCA / Wallet Auth
           │
           ├─► POST /orders/:id/confirm (OrdersController#confirm)
           │     └─► Order::ConfirmService.perform -> syncs state
           │
           └─► POST /orders/:id/finalize (OrdersController#finalize)
                 └─► FinalizeConfirmedChargeService.perform
                       ├─► Marks Purchase as :successful
                       ├─► Credits Balance & writes BalanceTransaction
                       ├─► Generates license keys (if software)
                       ├─► Stamps PDFs (PdfStampingService)
                       ├─► Enqueues receipts (SendPurchaseReceiptJob)
                       └─► Triggers seller workflow automations
```

---

## 5. Webhook Architecture & Idempotency

### 5.1 Inbound Webhook Routes (`ForeignWebhooksController`)

Located in `app/controllers/foreign_webhooks_controller.rb`:

- `POST /foreign_webhooks/stripe`: Validates Stripe HMAC signature with endpoint secret (`GlobalConfig.dig(:stripe, :endpoint_secret)`), enqueues `HandleStripeEventWorker`.
- `POST /foreign_webhooks/stripe_connect`: Handles connected account events.
- `POST /foreign_webhooks/paypal`: Validates PayPal webhook certificate & signature (`PaypalWebhookVerifier`), passes to `PaypalEventHandler`.

### 5.2 Idempotency Mechanics

1. **Event Deduplication**: `ProcessedStripeEvent.processed?(stripe_event["id"])` in `StripeChargeProcessor`. If an event was already processed, it returns immediately. On success, `ProcessedStripeEvent.record!(event_id)` logs the event.
2. **Database Locks**: Critical payment updates use pessimistic locking:
   - `purchase.with_lock`
   - `charge.with_lock`
   - Distributed Redis locks via `SuoSemaphore`.
3. **Transaction State Guards**: Purchases check terminal states (`return if purchase.paid? || purchase.refunded?`) before state mutation.

---

## 6. Money, Currency & Ledger Representation

### 6.1 Integer Representation

All monetary values are stored in integer cents (or lowest currency subdivision):

- `purchase.price_cents`
- `purchase.gumroad_fee_cents`
- `balance.amount_cents`
- Zero-decimal currencies (like JPY) use `single_unit: true` in `config/currencies.json`.

### 6.2 Currency Registry (`config/currencies.json` & `Currency` module)

In `app/business/payments/currency.rb`:

```ruby
CURRENCY_CHOICES.each do |currency_type, _currency_hash|
  const_set(currency_type.upcase, currency_type.downcase)
end

# These currencies are only used for creating Stripe Connect accounts and making payouts:
ETB = "etb"
```

**CRITICAL FINDING**: ETB is currently defined **only** as a secondary payout currency for Stripe Connect. It is **not** present in `config/currencies.json`. As a result, creators cannot price products in ETB, and the frontend `CurrencyCode` type does not recognize ETB!

### 6.3 Double-Entry Accounting Ledger

Gumroad tracks funds through `HolderOfFunds` (`app/business/payments/charging/holder_of_funds.rb`):

- `HolderOfFunds::GUMROAD`: Funds collected into Gumroad’s central bank account.
- `HolderOfFunds::STRIPE`: Funds held in custom Stripe Connect merchant accounts.
- `HolderOfFunds::CREATOR`: Directly transferred funds.

When a sale completes:

1. `BalanceTransaction.create_issued_amount_for_seller` records gross, net, and fee.
2. `Balance#amount_cents` is credited.
3. If an affiliate was involved, `BalanceTransaction.create_issued_amount_for_affiliate` records the commission.

---

## 7. Payout Architecture & Logic

In Gumroad, payouts are driven by:

- **`Payouts`** (`app/business/payments/payouts/payouts.rb`): Checks compliance (`user.compliant?`), minimum threshold (`user.minimum_payout_amount_cents`, default $100), and creates `Payment` records.
- **`ScheduledPayout`** (`app/models/scheduled_payout.rb`): Represents weekly/monthly payout batches.
- **`ExecuteScheduledPayoutsJob`** (`app/sidekiq/execute_scheduled_payouts_job.rb`): Daily cron iterating due payouts.
- **`PayoutProcessorType`** (`app/business/payments/payouts/payout_processor_type.rb`):
  ```ruby
  ALL = {
    PAYPAL => PaypalPayoutProcessor,
    STRIPE => StripePayoutProcessor
  }.freeze
  ```
  Only Stripe and PayPal are supported. Retired rails: ACH and ZENGIN.

---

## 8. Specific Couplings to Stripe, PayPal & US Infrastructure

The following concrete couplings must be addressed for ArifDrop:

| Component                                 | File / Location                                                                                    | Coupling Detail                                                                                          | ArifDrop Impact                                                                                                                                       |
| :---------------------------------------- | :------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stripe Elements & Confirmation Tokens** | `app/controllers/orders_controller.rb:58-75`, `app/javascript/components/Checkout/PaymentForm.tsx` | Assumes Stripe Payment Element mounts on frontend and returns `confirmation_token`.                      | Chapa uses standard redirect URL / popup iframe. Checkout form must support Chapa redirect flow.                                                      |
| **Connect Merchant Accounts**             | `app/models/merchant_account.rb`, `StripeMerchantAccountManager`                                   | Assumes creators connect their own Stripe/PayPal accounts for direct payouts.                            | In Ethiopia, ArifDrop operates as the central merchant of record (Platform Holder of Funds); creators do not have individual Chapa merchant accounts. |
| **Sales Tax / VAT**                       | `app/models/purchase_sales_tax_info.rb`, `app/services/taxjar_service.rb`                          | Uses TaxJar API calculating state-by-state US sales taxes and EU VAT rules.                              | TaxJar cannot calculate Ethiopian taxes. ArifDrop needs simple domestic 15% VAT calculation or flat exempt rules.                                     |
| **Payout Rail Validation**                | `app/controllers/api/internal/admin/payouts_controller.rb:100`                                     | Rejects any payout processor parameter that is not `stripe` or `paypal`.                                 | Must add manual payout option or export mechanism for Ethiopian banks / Telebirr.                                                                     |
| **Address Validation**                    | `app/models/purchase_address.rb`, `ZipCodeValidator`                                               | Enforces US/international postal zip code formatting.                                                    | Ethiopia does not use formal postal zip codes for general delivery. Must allow optional or default zip codes (e.g. `1000` or `0000`).                 |
| **Hard-coded USD Fallbacks**              | `app/models/user.rb:MIN_SALES_CENTS_VALUE_FOR_STORE_AGENT`, `Muse::Mcp#tool_list_sales:284`        | Compares sales directly in USD cents (`10_000` = $100 USD) and hardcodes USD currency in MCP sales tool. | Must evaluate against seller currency or convert ETB thresholds.                                                                                      |

---

## 9. Chapa Integration Blueprint

To integrate Chapa cleanly without disrupting core Gumroad logic:

1. **Add ETB to Currency Engine**:
   - Add `"etb"` entry into `config/currencies.json` with `"symbol": "Br"`, `"display_format": "Br (Ethiopian Birr)"`, and `"min_price": 1000` (10 ETB).
2. **Implement `ChapaChargeProcessor`**:
   - Create `app/business/payments/charging/implementations/chapa/chapa_charge_processor.rb`.
   - Inherit from `ChargeProcessor` interface.
   - Map Chapa checkout session initialization (`https://api.chapa.co/v1/transaction/initialize`).
3. **Add Inbound Webhook**:
   - In `ForeignWebhooksController`, add `def chapa` action with HMAC secret validation (`CHAPA_WEBHOOK_SECRET`).
   - Use `ProcessedChapaEvent` or extend event deduplication pattern.
4. **Finalize Purchase on Verification**:
   - When Chapa sends `charge.completed` or verify API returns success, call `FinalizeConfirmedChargeService.perform(charge)` to execute standard Gumroad product fulfillment, receipt generation, and ledger crediting.
