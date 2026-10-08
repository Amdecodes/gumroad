Yes. Here is the **handover prompt for the next agent**. It gives the agent the full product direction, what has already been completed, what to preserve, and exactly how to continue from **Step 2** without drifting into unnecessary rewrites.

Step 1 is already implemented and verified locally: `/admin` exists, the new shell/Overview is in place, existing Sidekiq/Flipper routes are preserved, and the reported RSpec, Vitest, TypeScript, and lint checks passed. 

# ArifDrop — Engineering Handover

You are taking over an existing project called **ArifDrop**.

## 1. WHAT ARIFDROP IS

ArifDrop is an Ethiopian adaptation of the open-source Gumroad codebase from:

```text
antiwork/gumroad
```

The repository is already cloned locally and the active branch is:

```text
arifdrop
```

The project is NOT being rebuilt from scratch.

The central strategy is:

> Preserve Gumroad's existing business logic and infrastructure. Build a simpler ArifDrop management experience around it. Modify business logic only where Ethiopia, ETB, Chapa, or Amharic actually requires a change.

---

# 2. MOST IMPORTANT PROJECT RULE

Do not turn this project into a rewrite.

Before implementing anything, ask:

```text
Does Gumroad already have this logic?
```

If yes:

```text
Reuse it.
```

If the problem is navigation or usability:

```text
Build a better UI around it.
```

If the problem is Ethiopia-specific:

```text
Modify only the required business logic.
```

If something is not needed immediately:

```text
Keep it or feature-flag it.
```

Do NOT delete working Gumroad functionality just because it is not part of the first launch.

---

# 3. EXISTING INFRASTRUCTURE — KEEP IT

The following infrastructure is intentionally preserved:

```text
Rails
MySQL
Redis
Elasticsearch
MinIO/storage
Sidekiq
Existing background jobs
Existing analytics
Existing accounting/ledger concepts
Existing monitoring
Existing feature flags / Flipper
Existing authentication
Existing admin authorization
Existing internal admin APIs
Existing tests
```

Do not replace these systems unless there is a demonstrated technical reason.

In particular:

### Sidekiq

Keep the existing Sidekiq setup and UI.

Existing route:

```text
/admin/sidekiq
```

### Feature flags

Keep Flipper.

Existing route:

```text
/admin/features
```

### Impersonation

Keep the existing admin impersonation mechanism.

Existing routes include:

```text
/admin/impersonate
/admin/unimpersonate
```

Do not create replacement implementations.

---

# 4. CURRENT ADMIN ARCHITECTURE

The repository already has substantial internal admin functionality.

Existing routes include internal admin operations for:

```text
purchases
licenses
products
users
payouts
scheduled payouts
piracy reports
stranded buyers
SendGrid/email operations
authentication
```

Existing admin controllers/services/models should be reused.

Do NOT create a second business-logic layer just because we are creating a new admin UI.

---

# 5. CURRENT FRONTEND STACK

The application already uses:

```text
Rails
+
Inertia
+
React
+
TypeScript
```

Existing frontend structure includes:

```text
app/javascript/inertia
app/javascript/pages
app/javascript/components
app/javascript/components/ui
```

Use the existing frontend conventions.

Reuse existing shared components.

Do not introduce:

```text
Next.js
Vue
another router
another state manager
another component library
another CSS framework
React Query
Redux
Zustand
```

unless the existing repository already uses them for the exact problem.

---

# 6. CURRENT PRODUCT STRATEGY

ArifDrop should retain Gumroad's broad product capabilities.

## KEEP

These remain part of the product:

```text
Digital products
Physical products
Courses
Memberships
Subscriptions
Marketplace / discovery
Creator storefront builder
Product variants / SKUs
Pay-what-you-want pricing
License keys
Bundles
Gifts
Reviews / ratings
Coupons / offers
Affiliates
Audience / customer management
Product delivery / downloads
Customer accounts
Marketing / growth tools
Analytics
Team access
Existing accounting / balance / ledger architecture
```

Previously selected feature groups that must remain preserved:

```text
3
4
6
10
14
24
41
43–49
50–59
68
```

Important:

The old numerical list is historical planning information.

When implementing, verify the actual meaning and implementation from the repository.

---

# 7. MODIFY

These are the areas that genuinely need ArifDrop-specific changes.

## Currency

Change the user-facing money experience to:

```text
ETB
```

Do not casually replace the entire existing accounting system.

Trace the existing money flow first.

Preserve the existing financial architecture wherever possible.

## Payments

ArifDrop will use:

```text
Chapa
```

instead of relying on Stripe/PayPal as the active launch payment methods.

Existing Gumroad payment logic should be reused where possible.

Do not create a second purchase system.

## Chapa flow

Target flow:

```text
Customer
    ↓
Checkout
    ↓
Create payment/purchase state
    ↓
Generate unique Chapa transaction reference
    ↓
Chapa initialize
    ↓
Customer pays
    ↓
Callback/webhook
    ↓
Verify webhook
    ↓
Verify transaction with Chapa
    ↓
Verify amount
    ↓
Verify currency
    ↓
Verify transaction reference
    ↓
Existing purchase finalization
    ↓
Fulfillment/access
```

Webhook processing must be idempotent.

A duplicate callback/webhook must not create duplicate financial effects.

Do not trust only browser redirect data.

Before implementation, verify current Chapa API fields/statuses directly from Chapa's current developer documentation.

---

# 8. SUBSCRIPTIONS

Subscriptions remain a core feature.

Do NOT remove the existing subscription model.

The change is the renewal payment mechanism.

Current conceptual Gumroad behavior:

```text
Subscription
    ↓
automatic recurring payment
```

ArifDrop target behavior:

```text
Subscription
    ↓
renewal reminder
    ↓
customer clicks Renew
    ↓
Chapa payment
    ↓
verify payment
    ↓
idempotent renewal finalizer
    ↓
extend subscription
```

The same payment cannot extend the same subscription period twice.

Existing subscription jobs and models should be reused wherever practical.

Do not create a second subscription model.

---

# 9. PAYOUTS

Initial ArifDrop payout process is:

```text
Creator balance
    ↓
Payout request
    ↓
Admin review
    ↓
Manual payment
    ↓
Mark paid
```

Existing balance, ledger, payout, and accounting structures should remain.

Automated payout rails are a later enhancement.

---

# 10. LOCALIZATION

Only two languages are required:

```text
English
Amharic
```

Locales:

```text
en
am
```

Do not build a huge multilingual system.

Priority for Amharic:

```text
Admin UI
Checkout
Creator dashboard
Customer account
Product/storefront
Subscriptions
Emails
Important system messages
```

English remains the default unless the existing product conventions dictate otherwise.

---

# 11. AI

The repository contains actual AI/customer-facing functionality.

Do not make AI a required dependency for core commerce.

Initial policy:

```text
Evaluate
Feature flag
Enable selectively
```

Do not create mandatory external AI costs for basic buying/selling operations.

Do not remove AI code casually.

---

# 12. ADMIN STRATEGY

This is one of the most important parts of ArifDrop.

We are creating a **simple unified admin control panel**.

The purpose is:

> Let one administrator manage and understand the platform through a clear UI without needing Rails console/database access for normal daily operations.

The new admin is a UI layer over existing application logic.

Target navigation:

```text
ARIFDROP

Overview

Creators
Products
Orders
Subscriptions
Payouts
Customers
Marketing
Reports

System
  Activity Log
  Team
  Jobs
  Feature Flags
```

Existing operational pages remain:

```text
System → Jobs
    /admin/sidekiq

System → Feature Flags
    /admin/features
```

---

# 13. ADMIN PRINCIPLE

Do not build this:

```text
New UI
    ↓
New Admin API
    ↓
New Services
    ↓
Duplicate business logic
```

Prefer:

```text
New ArifDrop UI
    ↓
Existing Rails/Inertia
    ↓
Existing models/services/controllers/jobs
```

The new UI should simplify access to existing functionality.

---

# 14. STEP 1 — COMPLETED

Step 1 has already been implemented.

Current admin route:

```text
GET /admin
```

Current implementation includes:

```text
AdminSidebar
AdminHeader
AdminLayout
Admin Overview page
Overview request spec
Overview React tests
```

The Overview contains:

```text
5 KPI cards
Needs-attention section
Sales/revenue trend
Recent orders
```

The implementation reused the existing `Admin::BaseController`, shared UI components, and existing data/models rather than creating a parallel backend. 

The implementation report states these checks passed:

```text
RSpec
Vitest
TypeScript
frontend lint
Ruby lint
```

with:

```text
9 RSpec examples — 0 failures
7 React tests passed
0 TypeScript errors
0 frontend lint errors
0 Ruby offenses
```



The browser has already been tested visually and the dashboard is rendering.

---

# 15. STEP 2 — CURRENT TASK

Implement:

```text
Creators
+
Orders
```

This is the current phase.

Do not jump ahead into Chapa, ETB, subscriptions, Amharic, or payouts.

---

# 16. STEP 2 — CREATORS

Create:

```text
/admin/creators
```

Purpose:

> Give the administrator one clean place to find and manage creators.

## Creator list

Suggested columns:

```text
Creator
Products
Sales
Revenue
Status
Joined
```

Support:

```text
Search
Basic filtering
Pagination
```

Search should use existing mechanisms where appropriate.

Inspect existing admin search/user services before creating anything new.

Do not create a new search engine just for this page.

---

# 17. CREATOR DETAIL

Create:

```text
/admin/creators/:id
```

Show useful information in one place:

```text
Profile
Products
Sales
Revenue
Customers
Subscriptions
Payouts
Risk/compliance
Admin notes
```

Do not dump every database column onto the page.

The page should answer:

> Who is this creator and what is happening with their account?

---

# 18. CREATOR ACTIONS

Where existing admin functionality supports them, expose selected everyday actions.

Possible actions:

```text
Suspend
Reinstate
Reset password
2FA management
Compliance information
Admin note
Impersonate
```

Dangerous actions require confirmation.

Use the existing business logic.

Do not duplicate action logic into new controllers/services.

---

# 19. ORDERS

Create:

```text
/admin/orders
```

Purpose:

> Give the administrator one place to find and investigate purchases.

Suggested columns:

```text
Customer
Product
Creator
Amount
Status
Date
```

Default:

```text
Newest first
```

Support:

```text
Search
Basic filters
Pagination
```

---

# 20. ORDER SEARCH

Investigate and reuse the existing purchase/admin search functionality.

Useful lookup fields where supported:

```text
Purchase ID
Customer email
Product
Creator
Transaction/reference ID
```

Do not invent search behavior unsupported by existing application logic.

---

# 21. ORDER DETAIL

Create:

```text
/admin/orders/:id
```

Show:

```text
Purchase ID
Customer
Creator
Product
Variant
Amount
Currency
Payment status
Purchase status
Created at
```

When applicable:

```text
Subscription
Refund
License
Gift
Affiliate
Delivery/access
```

The page should answer:

> What happened to this order?

---

# 22. ORDER ACTIONS

Reuse the existing purchase admin functionality.

Potential actions:

```text
Refund
Refund taxes
Cancel subscription
Resend receipt
Block buyer
Unblock buyer
Refund for fraud
```

Do not expose every internal capability automatically.

Only expose sensible daily admin actions.

Destructive actions require explicit confirmation.

---

# 23. AUDIT LOGGING

Do not create a second audit logging system.

The existing admin audit infrastructure must remain the source of truth for administrative actions.

When adding UI actions, ensure they continue through the existing authorization/audit path.

Do not bypass existing controls.

---

# 24. AUTHORIZATION

All new admin pages must use existing admin authorization.

Required behavior:

```text
Unauthenticated
    ↓
existing login behavior

Non-authorized user
    ↓
existing refusal behavior

Authorized admin/team member
    ↓
allowed
```

Do not create a new admin role/auth mechanism.

---

# 25. UI STYLE

Use the design established in Step 1.

Keep it:

```text
Simple
Clean
Professional
Fast
Easy to scan
Responsive
Accessible
```

Use existing shared components.

Do not introduce:

```text
Gradients
Emojis
New UI library
New CSS framework
Duplicate button/table/dialog components
```

---

# 26. PERFORMANCE

For list pages:

```text
Paginate
Avoid N+1
Preload required relationships
Reuse existing scopes
Keep queries simple
```

Do not load the entire Users or Purchases table into memory.

Do not add speculative indexes.

Do not introduce caching unless a real bottleneck is demonstrated.

---

# 27. TESTS

Add focused tests.

## Creators

Test:

```text
Authorization
Index
Search
Filters
Detail
Selected actions
```

## Orders

Test:

```text
Authorization
Index
Search
Detail
Selected actions
```

For destructive actions, verify that the existing behavior is invoked and audit behavior remains correct.

Add React tests for the important states:

```text
normal data
empty state
search
pagination/navigation
confirmation dialog
status display
```

Do not create a massive test suite.

---

# 28. TYPES AND CODE QUALITY

Use existing project conventions.

Keep:

```text
Controllers thin
Queries efficient
Server-side authorization
Strong TypeScript typing
Minimal abstractions
```

Avoid:

```text
any
unnecessary casts
duplicate services
duplicate APIs
unnecessary dependencies
```

---

# 29. DO NOT TOUCH THESE DURING STEP 2

Leave these for later:

```text
ETB
Chapa
Manual payout rail
Subscription renewal changes
Amharic
Product unpublish
Team management
Activity Log UI
Advanced analytics
```

Do not sneak unrelated changes into Step 2.

---

# 30. FULL ROADMAP AFTER STEP 2

The remaining implementation order is:

```text
STEP 1  Admin Shell + Overview          DONE

STEP 2  Creators + Orders               CURRENT

STEP 3  Payouts
        Existing payout logic first,
        then manual payout rail

STEP 4  Team + Activity Log

STEP 5  Products + Reports + System
        Complete admin navigation

STEP 6  ETB
        Audit all monetary paths
        Adapt currency handling

STEP 7  Chapa
        Initialization
        Verification
        Webhooks
        Idempotency
        Purchase finalization

STEP 8  Manual Subscription Renewal
        Reminder
        Chapa renewal
        Verification
        Period extension
        Idempotency

STEP 9  English + Amharic
        Core UI
        Checkout
        Creator/customer flows
        Emails

STEP 10 Marketplace + Storefront polish

STEP 11 Marketing and remaining preserved features

STEP 12 Feature-flag unsupported launch features

STEP 13 Security hardening

STEP 14 Full business-flow testing

STEP 15 Production deployment

STEP 16 Launch monitoring
```

---

# 31. FINAL FEATURE POLICY

## KEEP

```text
Digital products
Physical products
Courses
Memberships
Subscriptions
Marketplace
Discovery
Storefront builder
Variants
SKUs
Pay-what-you-want
License keys
Bundles
Gifts
Reviews
Coupons/offers
Affiliates
Marketing
Audience
Customer accounts
Downloads/delivery
Analytics
Team access
Accounting/ledger
Sidekiq
Redis
Elasticsearch
Storage
Flipper
Existing jobs
Existing monitoring
```

## MODIFY

```text
Currency → ETB

Payments → Chapa

Checkout → Chapa-aware

Webhook verification → Chapa

Purchase finalization → preserve existing logic, adapt payment source

Subscriptions → manual monthly renewal

Payouts → manual initially

Analytics → preserve existing system, adapt money/reporting where necessary

Localization → English + Amharic

Admin → new clear UI over existing logic
```

## FEATURE FLAG / LATER

```text
AI
Advanced automated payouts
Some advanced integrations
Advanced reporting
Specialized features not required for launch
```

## DISABLE FIRST, DELETE ONLY AFTER DEPENDENCY REVIEW

```text
Stripe checkout
PayPal checkout
US-specific active payment flows
US-specific assumptions that do not apply to ArifDrop
AI features that are not ready or create unnecessary external cost
```

Do NOT blindly delete Stripe/PayPal code.

Disable active use first, verify dependencies, then remove code only when it is proven safe.

---

# 32. WHAT SUCCESS LOOKS LIKE

ArifDrop should eventually provide:

## Customer

```text
Discover
→ product
→ checkout
→ ETB
→ Chapa
→ verified payment
→ access/delivery
```

## Creator

```text
Create store
→ create product
→ publish
→ sell
→ see customers
→ see revenue
→ manage subscriptions
→ request payout
```

## Admin

```text
Open /admin
→ immediately understand platform status
→ find creator
→ inspect creator
→ find order
→ inspect order
→ refund/manage when necessary
→ inspect subscriptions
→ manage payouts
→ see analytics
→ manage operational systems
```

Normal administrative tasks should not require Rails console or direct database edits.

---

# 33. NON-NEGOTIABLE

Do not optimize for "new code."

Optimize for:

```text
Reuse
Correctness
Security
Simplicity
Maintainability
Clear UI
Minimal business-logic changes
```

The end product should feel like a purpose-built Ethiopian creator-commerce platform while retaining the powerful Gumroad foundation underneath.

Start from the current state of the repository.

**Current task: Step 2 — Creators + Orders.**

Inspect the existing code first, then implement only this step.
