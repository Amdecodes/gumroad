# Payout Eligibility & Refund Protection Architecture

> Report-only document — no code changes. Last updated 2026-10-19.

This document describes how ArifDrop determines whether a seller may be paid out on any
given cycle date, and what prevents a refund request from succeeding after the seller's
balance has already left the platform.

---

## 1. Payout Thresholds

### Global minimum (`Payouts::MIN_AMOUNT_CENTS`)

Defined in [`app/business/payments/payouts/payouts.rb`](../../app/business/payments/payouts/payouts.rb):

```ruby
MIN_AMOUNT_CENTS = 100_00            # USD $100.00 — standard payout floor
REJECTED_ACCOUNT_MIN_AMOUNT_CENTS = 1_00   # USD $1.00 — floor for Stripe-rejected accounts
```

An instant payout uses a lower rail-specific floor:

```ruby
# app/business/payments/payouts/processor/stripe/stripe_payout_processor.rb
MINIMUM_INSTANT_PAYOUT_AMOUNT_CENTS = 1_00  # $1.00
```

### Per-seller minimum (`user.minimum_payout_amount_cents`)

Each seller's effective floor is the **maximum** of their configured threshold and the
country-specific cross-border minimum:

```ruby
# app/models/user.rb
def minimum_payout_amount_cents
  [payout_threshold_cents, minimum_payout_threshold_cents].max
end

def minimum_payout_threshold_cents
  country_code = alive_user_compliance_info&.legal_entity_country_code
  country = Country.new(country_code) if country_code.present?
  [Payouts::MIN_AMOUNT_CENTS, country&.min_cross_border_payout_amount_usd_cents].compact.max
end
```

`payout_threshold_cents` is a per-seller override stored in JSON data on the user row,
defaulting to `minimum_payout_threshold_cents`.

---

## 2. Hold Period

```ruby
# app/modules/user/payout_schedule.rb
PAYOUT_DELAY_DAYS = 7
```

Every balance entry matures 7 days after the sale. The payout cycle date is the end of the
platform's weekly Friday window; the seller is paid on their rail's assigned weekday
(Tuesday – Friday depending on bank type). Only balances whose sale date is
`≤ cycle_date − PAYOUT_DELAY_DAYS` are included in a payout.

Payout schedules: **weekly**, **monthly**, **quarterly**, or **daily** (instant-payout
eligible sellers only).

---

## 3. Compliance Gates

`Payouts.is_user_payable` enforces each gate in order before delegating to the
processor-specific eligibility check. A `false` from any gate blocks the entire payout.

### 3a. Balance below threshold

```ruby
below_minimum = account_balance < minimum_payout_amount_cents
```

A note is added to the seller's payout page if `add_comment: true`; no payout is
scheduled.

### 3b. Guardian requirement (minors)

```ruby
# Payouts.guardian_requirement_met?
return true if StripePayoutProcessor.pays_user_via_stripe_connect?(user)
compliance_info = user.alive_user_compliance_info
return true if compliance_info.nil?
return true unless compliance_info.under_legal_guardian_age?
compliance_info.legal_guardian_requirement_met?
```

Sellers under 18 whose legal-entity country does not support a guardian verification path
are blocked indefinitely until they turn 18. Where the path exists, the payout is held
until a guardian record is confirmed. Stripe Connect sellers are exempt because identity
verification is handled entirely by Stripe.

### 3c. Chargeback rate reserve

```ruby
if user.chargeback_rate_payout_reserve_active? && payout_type != PAYOUT_TYPE_INSTANT
  # Balance is placed in a risk reserve; no standard payout proceeds
end
```

### 3d. Processor-specific eligibility

After all platform gates pass, `PayoutProcessorType.get(type).is_user_payable(...)` is
called. For Stripe this verifies the Stripe Connect account status and bank account
linkage. For PayPal it verifies the payout email is confirmed.

---

## 4. Refund Protection After Payout

Once a seller's balance has been paid out, the funds physically leave the platform's
Stripe balance. ArifDrop does not maintain a central float to absorb refunds from
zero-balance sellers; instead it uses a layered defence:

### 4a. `amount_refundable_cents` — purchase-level cap

```ruby
# app/models/purchase.rb
def amount_refundable_cents
  return 0 unless charge_processor_id.in?(ChargeProcessor.charge_processor_ids) || chapa?
  price_cents - amount_refunded_cents
end
```

Only the unrefunded portion of a purchase can ever be refunded. Once fully refunded,
`amount_refundable_cents == 0` and every downstream refund attempt is rejected before
touching the gateway.

`amount_refunded_cents` excludes **reversed failed refunds** (`Refund.effective`):
if an async bank-transfer refund bounces and the balance debit is reversed, that failed
refund row does not count toward the cap, preserving the ability to re-attempt.

### 4b. Chapa local bounds check (`ChapaChargeProcessor`)

```ruby
# app/business/payments/charging/implementations/chapa/chapa_charge_processor.rb
refund_amount_cents = amount_cents.presence || purchase.amount_refundable_cents
if refund_amount_cents > purchase.amount_refundable_cents
  raise ChargeProcessorInvalidRequestError, "Refund amount …exceeds refundable amount"
end
```

Partial refunds exceeding the paid amount are rejected locally, before any Chapa API
call is made.

### 4c. Stable refund reference & pre-call persistence (`ChapaRefund`)

Before calling the Chapa Refund API, a `ChapaRefund` row is persisted with a stable
reference (`rf_chp_<tx_ref>_<seq>`). A `UNIQUE` index on `refund_reference` ensures
two concurrent requests for the same intent collapse to one DB row. On retry after a
timeout, the service reads Chapa's current state (`verify_transaction` /
`verify_refund`) rather than blindly issuing a second refund request.

### 4d. `LowBalanceFraudCheck` — seller-level probation

```ruby
# app/models/concerns/user/low_balance_fraud_check.rb
LOW_BALANCE_THRESHOLD  = -100_00   # USD -$100
HIGH_BALANCE_THRESHOLD = 100_00    # USD  $100
LOW_BALANCE_PROBATION_WAIT_TIME = 2.months
```

After every refund or chargeback, `LowBalanceFraudCheckWorker` fires within 5 seconds:

1. If `user.unpaid_balance_cents < -$100`, `AdminMailer.low_balance_notify` is sent and
   the seller is **put on probation** (payouts suspended, `refunds_disabled = true`).
2. If the seller's balance later recovers above `+$100` and probation was machine-applied,
   it is automatically lifted — **unless** a newer risk-state transition (e.g. a manual
   suspension) has since occurred.

The 2-month dedup window (`recently_probated_for_low_balance?`) prevents the system from
re-probating a seller on every refund while they are already on probation.

### 4e. `Balance::RefundEligibilityUnderwriter` — reactive re-check

Every time a `Balance` row's `amount_cents` changes (after commit), the underwriter
checks whether the change crosses a refund-eligibility boundary and, if so, enqueues
`UpdateSellerRefundEligibilityJob` to re-evaluate whether the seller's `refunds_disabled`
flag should be toggled.

### 4f. Stripe negative-balance handling

`AlertOnNegativeDestinationBalancesJob` monitors Stripe destination accounts for
negative balances and alerts on-call. For direct-to-Stripe-Connect sellers, Stripe
itself holds the funds and performs its own reserve logic; Gumroad does not control
that ledger.

---

## 5. Chapa-Specific Considerations

- **ETH/ETB currency**: Chapa transactions are denominated in ETB. `ChapaTransaction`
  stores `amount_cents` (ETB, smallest unit), `charge_decimal` (actual gateway fee as a
  decimal fraction), and `tx_ref` (Chapa's transaction reference).
- **No Chapa-side payout**: ArifDrop does not currently route ETB seller balances through
  Chapa for payout. Seller earnings from Chapa purchases are settled into the platform's
  ETB account and later manually reconciled or converted. Chapa refunds debit the
  platform's Chapa wallet, not the seller's Stripe balance.
- **`ChapaRefund` status interaction**: When `ChapaRefund#status` transitions to
  `"refunded"`, `purchase.refund_purchase!` is called, which debits the seller's
  internal ArifDrop balance via `FlowOfFunds`. If that balance is already at zero (fully
  paid out), `LowBalanceFraudCheck` fires and the seller enters probation within seconds.
- **`reversed` webhook**: Gateway-initiated reversals (`Chapa::ProcessWebhookJob`) follow
  the same path — they call `purchase.refund_purchase!`, which triggers the full balance
  debit + `LowBalanceFraudCheckWorker` chain.

---

## 6. Gap: No Chapa-Specific Payout Hold

ArifDrop today has no explicit Chapa payout rail. The `PAYOUT_DELAY_DAYS = 7` window
protects Stripe-settled balances; for ETB/Chapa settlements the protection relies
entirely on the purchase-level `amount_refundable_cents` cap and manual reconciliation.
This is acceptable while Chapa volumes are small, but should be reviewed before enabling
automated ETB payouts.
