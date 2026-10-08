Yes. Here is the **current ArifDrop feature decision list we have agreed on**. The important distinction is that **“Remove” usually means disable/hide for ArifDrop, not immediately delete the underlying Gumroad code**.

## 1. KEEP — part of ArifDrop

These stay as core functionality and we should reuse the existing Gumroad logic.

| Feature                                         | Decision                                  |
| ----------------------------------------------- | ----------------------------------------- |
| Digital products                                | **KEEP**                                  |
| Physical products                               | **KEEP**                                  |
| Courses                                         | **KEEP**                                  |
| Memberships                                     | **KEEP**                                  |
| Subscriptions                                   | **KEEP**                                  |
| Marketplace / discovery                         | **KEEP**                                  |
| Creator storefront builder                      | **KEEP**                                  |
| Product variants / SKUs                         | **KEEP**                                  |
| Pay-what-you-want pricing                       | **KEEP**                                  |
| License keys                                    | **KEEP**                                  |
| Bundles                                         | **KEEP**                                  |
| Gifts                                           | **KEEP**                                  |
| Reviews / ratings                               | **KEEP**                                  |
| Coupons / offers                                | **KEEP**                                  |
| Affiliates                                      | **KEEP**                                  |
| Marketing / growth tools                        | **KEEP — full**                           |
| Audience / customer management                  | **KEEP**                                  |
| Product delivery / downloads                    | **KEEP**                                  |
| Customer accounts                               | **KEEP**                                  |
| Analytics                                       | **KEEP**                                  |
| Team access                                     | **KEEP**                                  |
| Communities / related creator features          | **KEEP / evaluate during implementation** |
| Existing accounting / balance / ledger concepts | **KEEP**                                  |
| Sidekiq                                         | **KEEP**                                  |
| Redis                                           | **KEEP**                                  |
| Elasticsearch                                   | **KEEP**                                  |
| MinIO / storage architecture                    | **KEEP**                                  |
| Flipper                                         | **KEEP**                                  |
| Existing monitoring / jobs / infrastructure     | **KEEP**                                  |

Your specifically selected numbered groups remain preserved:

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

The exact numbering is from the earlier feature list we were using; for implementation, the repository's actual code is the source of truth.

The underlying Gumroad repository already contains a broad creator-commerce system rather than just a basic digital-download shop. ([GitHub][1]) 

---

# 2. MODIFY — required for Ethiopia / ArifDrop

These stay, but their implementation changes.

| Feature                            | ArifDrop change                                                      |
| ---------------------------------- | -------------------------------------------------------------------- |
| Currency                           | **USD-oriented behavior → ETB**                                      |
| Payments                           | **Stripe/PayPal-centered flow → Chapa**                              |
| One-time checkout                  | **Modify for Chapa initialization + verification**                   |
| Webhooks                           | **Chapa webhook verification + idempotency**                         |
| Refund/payment finalization        | **Adapt to Chapa while preserving existing purchase logic**          |
| Subscriptions                      | **Keep subscription model, change renewal payment mechanism**        |
| Subscription renewal               | **Manual monthly renewal through Chapa**                             |
| Payouts                            | **Manual payout workflow initially**                                 |
| Financial display                  | **ETB throughout ArifDrop UI**                                       |
| Localization                       | **English + Amharic**                                                |
| Admin                              | **New simple ArifDrop admin UI over existing logic**                 |
| Analytics                          | **Reuse existing analytics; adapt monetary display/queries for ETB** |
| Ethiopian payment/admin operations | **Add where Chapa requires them**                                    |

The subscription decision is:

```text
Existing:
Subscription
→ automatic recurring charge

ArifDrop:
Subscription
→ renewal reminder
→ customer pays with Chapa
→ verify payment
→ extend subscription
```

And the payment principle stays:

```text
Chapa
→ verify
→ existing purchase finalization
```

rather than building a second purchase system.

---

# 3. KEEP BUT FEATURE-FLAG / LAUNCH LATER

These aren't being deleted. They simply don't need to be active on day one.

| Feature                                | Initial decision                    |
| -------------------------------------- | ----------------------------------- |
| AI customer features                   | **EVALUATE / feature-flag**         |
| Community-related advanced features    | **KEEP / phase later where needed** |
| Advanced tax integrations              | **LATER**                           |
| Advanced international payment methods | **OFF initially**                   |
| Advanced automated payout rails        | **LATER**                           |
| Less-important product types           | **KEEP, expose gradually**          |
| Advanced reporting                     | **LATER**                           |
| Some specialized Gumroad integrations  | **LATER / OFF**                     |

The repository also contains AI-related dependencies and features, so we're not pretending the AI layer doesn't exist; we're just not making it a core launch dependency. ([GitHub][2]) 

---

# 4. DISABLE / REMOVE FROM ARIFDROP'S INITIAL EXPERIENCE

These are the things we don't want users/admins interacting with initially.

Again, **disable/hide first; don't blindly delete code**.

| Feature                                                            | Decision                              |
| ------------------------------------------------------------------ | ------------------------------------- |
| Stripe checkout                                                    | **DISABLE**                           |
| PayPal checkout                                                    | **DISABLE**                           |
| US-specific payment assumptions                                    | **REMOVE from active flow**           |
| Unneeded US-specific tax/payment UI                                | **DISABLE / LATER**                   |
| Payment methods unavailable through our launch setup               | **DISABLE**                           |
| AI features that create unnecessary external cost                  | **DISABLE until evaluated**           |
| Internal Gumroad-only operational UI that isn't useful to ArifDrop | **HIDE from normal admin navigation** |

Stripe/PayPal shouldn't be ripped out immediately because other Gumroad components may still reference their infrastructure. The safer approach is **feature-flag/off first, dependency-map, then remove code later when proven unnecessary**.

---

# 5. ADMIN — our new layer

This is **not a new business system**. It's a new UI over the existing system.

```text
ArifDrop Admin

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
├── Activity Log
├── Team
├── Jobs
└── Feature Flags
```

### Admin philosophy

```text
Existing logic
      ↓
New clear UI
```

Not:

```text
New UI
→ New API
→ New service
→ duplicate logic
```

We've already started this with **Overview**, and Step 2 is **Creators + Orders**.

---

# 6. LANGUAGE

Only:

```text
EN
አማ
```

No need for French, Spanish, German, Arabic, etc.

Priority:

```text
Admin
Checkout
Creator dashboard
Customer area
Product/storefront
Subscriptions
Emails
Core system messages
```

---

# 7. WHAT WE ARE NOT BUILDING

We are deliberately avoiding:

```text
new accounting system
new analytics engine
new job system
new authentication system
new admin backend architecture
new payment architecture unrelated to Chapa
new subscription model
new storage architecture
new multilingual framework
AI-first architecture
```

---

## The simplest way to remember the whole decision

```text
                ARIFDROP

        KEEP GUMROAD FEATURES
                │
        ┌───────┴────────┐
        │                │
      KEEP            MODIFY
        │                │
   Most features     ETB
   existing logic    Chapa
   Sidekiq           subscriptions
   analytics         payouts
   marketplace       Amharic
   storefront        admin UI
        │
        └───────────────┐
                        │
                FEATURE FLAG /
                    LATER
                        │
                 AI / advanced
                 integrations
                        │
                        ▼
                  DISABLE/OFF
                        │
              Stripe / PayPal
              US-specific flow
```

### One important rule going forward

**We don't decide “remove” just because something isn't part of the MVP.**

Our default is:

```text
Already works + compatible
→ KEEP

Works but needs Ethiopia changes
→ MODIFY

Works but not needed now
→ FEATURE FLAG / LATER

Actually incompatible or unnecessary
→ DISABLE, then DELETE only after dependency review
```

That keeps ArifDrop powerful and prevents us from accidentally breaking useful Gumroad functionality.

[1]: https://github.com/antiwork/gumroad?utm_source=chatgpt.com "GitHub - antiwork/gumroad: See what sticks · GitHub"
[2]: https://github.com/antiwork/gumroad/blob/main/package.json?utm_source=chatgpt.com "gumroad/package.json at main · antiwork/gumroad · GitHub"
