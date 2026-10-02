# ArifDrop Dependency & Business Flow Map

**Project**: ArifDrop (Gumroad fork for Ethiopia)  
**Date**: October 2026  
**Auditor**: Antigravity Assistant  
**Repository Baseline**: `antiwork/gumroad` (`cc4d616c7`)

---

## 1. Overview

This document maps the primary business flows of the Gumroad platform, detailing each step from incoming HTTP request through database models, background workers, and external service dependencies. It highlights **shared core infrastructure that must NOT be removed or refactored** during the ArifDrop adaptation for Ethiopia.

---

## 2. Business Flow Dependency Diagrams & Traces

### Flow 1: Product -> Checkout -> Payment -> Purchase -> Access

```
[Product Page / Cart]
         │
         ▼
[OrdersController#create / #prepare]
         │
         ├──► Order::CreateService
         │      ├── Validates cart item counts (Cart::MAX_ALLOWED_CART_PRODUCTS)
         │      ├── Computes discounts (OfferCode, PurchasingPowerParityDiscount)
         │      └── Creates Order & Purchase records (state: :in_progress)
         │
         ├──► Order::ChargeService OR Order::PreparePaymentIntentService
         │      ├── Groups purchases by seller
         │      ├── Creates Charge record ("CH-xxxx")
         │      └── Dispatches to ChargeProcessor (Stripe / Chapa)
         │
         ▼
[Client Confirmation / Webhook]
         │
         ├──► OrdersController#finalize OR ForeignWebhooksController
         │      └── FinalizeConfirmedChargeService
         │            ├── Marks Purchase as :successful (stamps succeeded_at)
         │            ├── Generates License keys (app/models/license.rb)
         │            ├── Enqueues StampPdfForPurchaseJob (PDF watermarking)
         │            ├── Credits Balance (app/models/balance.rb)
         │            ├── Writes BalanceTransaction ledger entry
         │            ├── Enqueues SendPurchaseReceiptJob (email receipt)
         │            └── Schedules Workflow automations (Workflow::Installment)
         │
         ▼
[Content Access]
         ├── LibraryController#index (permanent access via /library)
         ├── UrlRedirectsController#download (presigned S3 download URL)
         └── UrlRedirectsController#stream (HLS video / audio stream)
```

**Key Code Dependencies**:

- Models: `Order`, `Charge`, `Purchase`, `Balance`, `BalanceTransaction`, `License`, `UrlRedirect`.
- Services: `Order::CreateService`, `Order::ChargeService`, `FinalizeConfirmedChargeService`.
- External: S3 / ActiveStorage for file storage; Chapa for payment capture.

---

### Flow 2: Subscription -> Billing -> Renewal -> Access

```
[Active Subscription]
         │
         ├──► Subscription#schedule_renewal_reminder
         │      └── RecurringChargeReminderWorker (Sidekiq)
         │            └── Dispatches reminder email with renewal link
         │
         ├──► Subscription#schedule_charge (Existing Auto-billing)
         │      └── RecurringChargeWorker (Sidekiq)
         │            ├── Acquires distributed lock via SuoSemaphore
         │            ├── Checks grace period (ALLOWED_TIME_BEFORE_FAIL_AND_UNSUBSCRIBE = 5.days)
         │            └── Subscription#charge!(off_session: true)
         │
         ▼ (ArifDrop Adaptation: Manual Chapa Renewal)
[Customer Initiates Renewal via Link]
         │
         ├──► SubscriptionsController#renew
         │      ├── Builds renewal Purchase linked to subscription
         │      └── Redirects to Chapa checkout
         │
         ├──► Chapa Webhook / Verification
         │      ├── Verifies HMAC signature
         │      ├── Checks idempotency on Chapa transaction ref
         │      ├── Locks subscription (subscription.with_lock)
         │      ├── Extends subscription period from previous end date
         │      └── Stamps renewal Purchase as :successful
         │
         ▼
[Access Gate Evaluation]
         ├── Subscription#grant_access_to_product?
         └── Subscription#alive? (cancelled_at.nil? && failed_at.nil?)
```

**Key Code Dependencies**:

- Models: `Subscription`, `Purchase`, `VariantCategory` (tier), `Price`.
- Workers: `RecurringChargeWorker`, `RecurringChargeReminderWorker`, `FindExpiredSubscriptionsToSetAsDeactivatedWorker`, `SetSubscriptionAsDeactivatedWorker`.
- Locking: `SuoSemaphore.recurring_charge(subscription_id)` (Redis distributed lock).

---

### Flow 3: Seller -> Balance -> Payout

```
[Successful Purchases]
         │
         ▼
[Balance Ledger Accumulation]
         ├── Balance#amount_cents (aggregated by holding_currency & merchant_account)
         └── BalanceTransaction (immutable audit records of credits and debits)
         │
         ▼
[Payout Batch Generation]
         ├── Payouts.create_payments (app/business/payments/payouts/payouts.rb)
         │      ├── Verifies User#compliant?
         │      ├── Verifies minimum balance (User#minimum_payout_amount_cents)
         │      └── Creates Payment record (state: :creating -> :processing)
         │
         ├── ScheduledPayout (app/models/scheduled_payout.rb)
         └── ExecuteScheduledPayoutsJob (app/sidekiq/execute_scheduled_payouts_job.rb)
         │
         ▼ (ArifDrop Manual Adaptation)
[Disbursement & Admin Verification]
         ├── Admin reviews batch via /api/internal/admin/scheduled_payouts
         ├── Exports batch to bank / Telebirr CSV
         ├── Executes bank transfers in Ethiopia
         └── Marks ScheduledPayout as :executed (writes completed Payment records)
```

**Key Code Dependencies**:

- Models: `User`, `Balance`, `BalanceTransaction`, `Payment` (payout entity), `ScheduledPayout`.
- Classes: `Payouts`, `PayoutProcessorType`.
- Controllers: `Api::Internal::Admin::PayoutsController`, `Api::Internal::Admin::ScheduledPayoutsController`.

---

### Flow 4: Product -> Fulfillment & Content Delivery

```
[Seller Product Upload]
         │
         ▼
[SaveFilesService]
         ├── Uploads raw asset to AWS S3 (or MinIO)
         ├── Creates ProductFile record
         │
         ├── If PDF:
         │     └── Checks if stampable (PdfStampingService.can_stamp_file?)
         │
         └── If Video / Audio:
               └── TranscodeVideoForStreamingWorker
                     ├── AWS Elemental MediaConvert / GRMC
                     └── Generates HLS (.m3u8 playlist + .ts video fragments)
         │
         ▼
[Buyer Fulfillment upon Purchase]
         ├── StampPdfForPurchaseJob (calls qpdf --overlay to watermark buyer email)
         ├── UrlRedirectsController#download (generates S3 presigned URL with expiry)
         └── UrlRedirectsController#stream (serves streaming media player)
```

**Key Code Dependencies**:

- Models: `ProductFile`, `StampedPdf`, `UrlRedirect`.
- Services: `PdfStampingService::Stamp`, `PdfStampingService::StampForPurchase`, `SaveFilesService`.
- Workers: `StampPdfForPurchaseJob`, `TranscodeVideoForStreamingWorker`.
- System Binaries: `qpdf` installed on server.

---

### Flow 5: Marketplace -> Discovery & Search

```
[Search Query / Taxonomy Filter]
         │
         ▼
[DiscoverController#index]
         │
         ├── SearchProducts concern (app/controllers/concerns/search_products.rb)
         │      ├── Normalizes parameters (tags, filetypes, taxonomies, price)
         │      └── Executes Link.search via Elasticsearch (EsClient)
         │
         ├── Category & Facet Aggregations (tags.keyword, filetypes.keyword)
         ├── Curated Products & Staff Picks (DiscoverCuratedProducts concern)
         └── ProductPresenter.card_for_web (formats JSON cards for React UI)
         │
         ▼
[Search History & Suggestions]
         ├── DiscoverSearch (records queries for analytics)
         └── DiscoverSearchSuggestion (powers live search autocomplete)
```

**Key Code Dependencies**:

- Models: `Link`, `Taxonomy`, `TaxonomyAttribute`, `DiscoverSearch`, `DiscoverSearchSuggestion`.
- Client: `EsClient` (`Elasticsearch::Client` in `config/initializers/elasticsearch.rb`).
- Controllers: `DiscoverController`, `Concerns::SearchProducts`.

---

### Flow 6: AI -> Providers & Feature Flags

```
[Seller Dashboard: /agent OR /internal/ai_product_details_generations]
         │
         ▼
[Eligibility Gate]
         ├── User#eligible_for_store_agent? (confirmed?, sales >= $100 USD)
         └── User#eligible_for_ai_product_generation?
         │
         ▼
[Feature Flag Checks]
         ├── Feature.active?(:store_agent_deepseek, seller)
         └── Feature.active?(:store_agent_grok, seller)
         │
         ▼
[API Clients & Gateways]
         ├── Ai::AnthropicClient (Vercel AI Gateway OR OpenRouter)
         └── OpenAI::Client (OpenAI REST API)
```

**Key Code Dependencies**:

- Models: `AiConversation`, `AiMessage`.
- Services: `Ai::StoreAgentService`, `Ai::ProductDetailsGeneratorService`, `Ai::AnthropicClient`.
- Environment: `STORE_AGENT_AI_GATEWAY_API_KEY`, `OPENAI_ACCESS_TOKEN`.

---

## 3. Shared Code That Must NOT Be Removed

When adapting Gumroad for ArifDrop in Ethiopia, the following foundational code layers must **remain intact**:

1. **`Purchase` & `Order` Lifecycle Models**:
   - `app/models/purchase.rb` and `app/models/order.rb` contain over a decade of edge-case protection (refund cascades, affiliate accounting, license key attachments, customer association). They must not be modified or replaced.
2. **Double-Entry Ledger (`Balance` & `BalanceTransaction`)**:
   - `app/models/balance.rb` and `app/models/balance_transaction.rb` are mathematically solid and immutable. All Chapa payments and manual Ethiopian payouts must continue booking through this ledger.
3. **Fulfillment & Security Infrastructure**:
   - `app/controllers/url_redirects_controller.rb`
   - `app/services/pdf_stamping_service/`
   - Signed URL tokens (`ObfuscateIds`, `SecureRandom`, Redis tokens) prevent unauthorized asset downloads.
4. **License Key Management**:
   - `app/models/license.rb` and `app/controllers/api/v2/licenses_controller.rb` provide critical software licensing functionality for tech creators.
5. **Distributed Locking & Job Queues**:
   - `SuoSemaphore` (Redis distributed locks) prevents double charging and race conditions in financial operations.
   - Sidekiq worker hierarchy and retry mechanisms.
6. **Feature Flag Harness**:
   - `lib/utilities/feature.rb` and `config/initializers/feature_toggle.rb` (Flipper) provide safe runtime control over the entire platform.
