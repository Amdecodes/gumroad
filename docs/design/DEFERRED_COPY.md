# Deferred Copy & Locale Requests

This document tracks all user-facing copy additions and adjustments requested during the ArifDrop UI rebrand.
Per the strict multi-agent rules:
> **The REDESIGN agent does not edit locale files (`config/locales`, `app/javascript/locales`), `t()`/`translate()` calls, titles/meta strings, or any copy.**
> All new strings and copy adjustments are recorded here for the **LOCALIZATION agent** working on `feat/amharic-i18n-admin-layout`.

---

## 1. Discover Hero Section

| Key | Current Fallback / Workaround | Redesign Usage Location | Proposed English (`en`) | Proposed Amharic (`am`) |
|---|---|---|---|---|
| `discover.hero_title` | Reusing `discover.seo_title` | `app/javascript/pages/Discover/Index.tsx` hero headline | "Discover products from Ethiopian and global creators" | "ከኢትዮጵያና ከዓለም ዙሪያ ፈጣሪዎች ልዩ ዲጂታል ምርቶችን ያግኙ" |
| `discover.hero_subtitle` | *(Omitted currently to avoid hardcoded text)* | `app/javascript/pages/Discover/Index.tsx` hero subtext | "Explore digital assets, software, courses, and art delivered instantly." | "ዲጂታል ንብረቶችን፣ ሶፍትዌሮችን፣ ስልጠናዎችን እና የጥበብ ስራዎችን ወዲያውኑ ያግኙ።" |

---

## 2. Buyer Mobile Tab Bar

Currently using existing keys to prevent new key requirements:
- `navigation.discover` ("Discover" / "አግኝ")
- `navigation.library` ("Library" / "ቤተ-መጽሐፍት")
- `navigation.dashboard` ("Dashboard" / "ዳሽቦርድ")
- `auth.log_in` ("Log in" / "ግባ")

---

## 3. Product Page & Storefront (Slice 2)

Existing keys are strictly reused for Slice 2:
- Price tags: `t("product.free")`, `t("product.pay_what_you_want")`
- Purchase buttons: `t("product.buy_this")`, `t("product.i_want_this")`, `t("product.subscribe")`, `t("product.pre_order")`, `t("product.sold_out")`
- Ratings & Reviews: `t("product.ratings")`, `t("product.reviews")`, `t("product.customer_reviews")`
- Follow / Storefront: `t("profile.follow")`, `t("profile.following")`, `t("profile.products")`, `t("profile.posts")`
- Library tabs: `t("library.purchases")`, `t("library.saved")`, `t("library.following")`, `t("library.reviews")`

If additional copy keys are desired during future slices (such as creator quick-action tooltips), they will be cataloged here for the localization agent.
