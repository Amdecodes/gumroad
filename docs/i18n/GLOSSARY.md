# ArifDrop Amharic (አማርኛ) Localization Glossary

This glossary documents the standard terminology and stylistic conventions used across the ArifDrop platform for Amharic localization (`am`), with particular emphasis on buyer checkout, delivery, and payment flows.

---

## 1. Core Terminology

| English Term                   | Amharic Translation               | Context / Usage                         | Notes / Rationale                                                                                      |
| :----------------------------- | :-------------------------------- | :-------------------------------------- | :----------------------------------------------------------------------------------------------------- |
| **Product**                    | **ምርት**                           | E-commerce items, digital goods, files  | Universal standard term.                                                                               |
| **Creator / Seller**           | **ሻጭ**                            | Merchant, digital seller, author        | Standardized on ሻጭ (plural: ሻጮች, possessive: የሻጭ) to prevent religious/theological ambiguity with ፈጣሪ. |
| **Customer / Buyer**           | **ደንበኛ / ገዢ**                     | Purchaser, consumer                     | ደንበኛ (customer, polite); ገዢ (buyer).                                                                   |
| **Checkout**                   | **ክፍያ መፈጸሚያ**                     | Purchase page, order review             | Descriptive and clear for Ethiopian buyers.                                                            |
| **Pay / Pay now**              | **ይክፈሉ / አሁኑኑ ይክፈሉ**              | Primary CTA buttons                     | Polite plural/respectful imperative form (`ይክፈሉ`) rather than informal `ክፈል`.                          |
| **Pay with Chapa**             | **በቻፓ ይክፈሉ**                      | Ethiopian local payment rail            | Native mobile banking & Telebirr aggregator.                                                           |
| **Price**                      | **ዋጋ**                            | Product price display                   | Universal standard term.                                                                               |
| **Subtotal**                   | **ንዑስ ድምር**                       | Order calculation line                  | Standard accounting terminology.                                                                       |
| **Total**                      | **ጠቅላላ ድምር** (or **ድምር**)         | Final cart sum                          | Standard accounting terminology.                                                                       |
| **Discount / Offer Code**      | **ቅናሽ / የቅናሽ ኮድ**                 | Coupon, promo code inputs               | Standardized term across Ethiopian commerce.                                                           |
| **Tip**                        | **ጉርሻ**                           | Optional gratuity added at checkout     | Cultural and colloquial standard for tip/gratuity.                                                     |
| **Receipt**                    | **ደረሰኝ**                          | Post-purchase confirmation              | Standard term for payment proof.                                                                       |
| **Invoice**                    | **ደረሰኝ** (or **የክፍያ መጠየቂያ**)      | Formal billing invoice                  | ደረሰኝ in common context; የክፍያ መጠየቂያ for requests.                                                       |
| **Refund**                     | **ተመላሽ ገንዘብ**                     | Return of funds to buyer                | Polite, unambiguous standard.                                                                          |
| **Payout**                     | **የሻጭ ክፍያ**                       | Transfers from platform to seller       | Standardized on የሻጭ ክፍያ (plural: የሻጭ ክፍያዎች) to cleanly differentiate from inbound buyer payments.      |
| **Installment (Plan)**         | **የክፍያ ዕቅድ (ተከፋይ ክፍያ)**           | Split payments over time                | Descriptive and avoids loan/credit connotations.                                                       |
| **Subscription / Membership**  | **የአባልነት ምዝገባ**                   | Recurring payments, memberships         | Combines membership (አባልነት) and enrollment (ምዝገባ).                                                     |
| **Dispute / Dispute Evidence** | **ክርክር / የክርክር ማስረጃ**             | Chargeback, contested payment           | Standard legal and banking terminology.                                                                |
| **Quantity**                   | **ብዛት**                           | Item count                              | Standard ecommerce term.                                                                               |
| **Seats**                      | **መቀመጫዎች**                        | Multi-seat license count                | Literal and standard in software licensing.                                                            |
| **Rent**                       | **ይከራዩ**                          | Time-limited digital rental             | Polite imperative form.                                                                                |
| **Buy**                        | **ይግዙ**                           | Permanent digital purchase              | Polite imperative form.                                                                                |
| **Free**                       | **ነፃ**                            | Zero-price items                        | Universal standard term.                                                                               |
| **Save / Save changes**        | **አስቀምጥ / ለውጦችን አስቀምጥ**           | Button actions                          | Clear data persistence terminology.                                                                    |
| **Cancel**                     | **ሰርዝ**                           | Modal dismissal, action abort           | Universal standard term.                                                                               |
| **Download**                   | **ያውርዱ**                          | Digital product delivery                | Polite imperative form.                                                                                |
| **Magic Link**                 | **የቀጥታ መግቢያ አገናኝ**                | Passwordless login link sent via email  | Clear, user-friendly security terminology.                                                             |
| **Two-Factor Authentication**  | **ባለ ሁለት ደረጃ ማረጋገጫ**              | Two-step login verification             | Standard tech and banking security term.                                                               |
| **Preorder**                   | **ቅድመ-ትዕዛዝ**                      | Advance order prior to product release  | Standard e-commerce term.                                                                              |
| **Shipment / Shipped**         | **ጭነት / ተልኳል**                    | Physical product order dispatch         | Standard logistics terminology.                                                                        |
| **Sales Tax / VAT**            | **የሽያጭ ታክስ / ተጨማሪ እሴት ታክስ (VAT)** | Indirect consumption taxes              | Standard Ethiopian Ministry of Revenues terminology.                                                   |
| **Sign in / Log in**           | **ይግቡ**                           | User authentication entry               | Standard web and app terminology.                                                                      |
| **Sign out / Log out**         | **ይውጡ**                           | Session termination                     | Standard web and app terminology.                                                                      |
| **Reset Password**             | **የይለፍ ቃል ይቀይሩ**                  | Credential recovery flow                | Polite action phrase.                                                                                  |
| **Verification Code**          | **የማረጋገጫ ኮድ**                     | Two-factor and email authentication OTP | Clear, standard security terminology.                                                                  |

---

## 2. Currency and Numerical Standards

| English                  | Amharic               | Format Rule                                                                                                                                                                 |
| :----------------------- | :-------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ethiopian Birr (ETB)** | **የኢትዮጵያ ብር (ብር)**    | In Amharic locale, ETB uses the symbol `ብር` placed after or before the amount (e.g., `100.00 ብር`). In English locale, the ISO code `ETB` is displayed (e.g., `100.00 ETB`). |
| **Santim**               | **ሳንቲም**              | Subunit of Birr (1/100).                                                                                                                                                    |
| **Pluralization**        | `{count}` one / other | Ethiopic verbs adapt based on singular/plural agreement: e.g. `{count} ቀርቷል` (1 left) vs `{count} ቀርተዋል` (2+ left).                                                         |

---

## 3. Style and Tone Guidelines

1. **Politeness in Financial Actions**:
   - Ethiopian financial transactions expect respectful language. Calls to action addressing buyers must use the polite third-person imperative prefix `ይ-` (e.g., `ይክፈሉ`, `ይግዙ`, `ያውርዱ`, `ያረጋግጡ`).
2. **Clarity Over Direct Literalism**:
   - Do not translate English idioms word-for-word. E.g., "Name a fair price" is translated as "ተመጣጣኝ ዋጋ ይጥቀሱ:" rather than a literal "ስም ስጥ".
3. **Typography**:
   - Always ensure Ethiopic Fidel Unicode characters (`U+1200` to `U+137F`) are styled with `Noto Sans Ethiopic` or system fallbacks (`Nyala`, `Abyssinica SIL`) with line-height of `1.5` to prevent diacritic clipping.

---

### 4. Resolved Terminology Decisions

### A. Creator vs. Seller: Standardized on ሻጭ

- **Decision**: Standardized on **ሻጭ** (plural: **ሻጮች**, possessive: **የሻጭ**) for all platform seller and creator roles. This removes inappropriate theological connotations of **ፈጣሪ** (traditionally reserved for God / the Divine Creator in everyday Amharic).
- **Applied**: Global replacement completed across `app/javascript/locales/am/*.ts`, `config/locales/am.yml`, and documentation.

### B. Tip vs. Discount: ጉርሻ vs ቅናሽ

- **Decision**: Maintained **ጉርሻ** strictly for checkout buyer tips/gratuity, and **ቅናሽ** / **የቅናሽ ኮድ** strictly for discounts and promo codes.
- **Applied**: Verified distinct across checkout, storefront, and discover filters.

### C. Payout Terminology: Standardized on የሻጭ ክፍያ

- **Decision**: Standardized on **የሻጭ ክፍያ** (singular) / **የሻጭ ክፍያዎች** (plural).
- **Rationale**: Replaces generic **ክፍያዎች** and **የገንዘብ ክፍያ** to cleanly eliminate ambiguity between buyer incoming payments and merchant disbursements.
- **Applied**: Global replacement completed in `admin.ts`, `am.yml`, and documentation.

### D. Brand Names (Chapa): ቻፓ vs Chapa

- **The Issue**: Tech brand names in Ethiopian software UIs (Telebirr, Chapa, CBE Birr) are usually kept in Latin script or matched to official guidelines.
- **Current occurrences**:
  1. `app/javascript/locales/am/actions.ts:5` (`actions.pay_with_chapa`): `"በቻፓ ይክፈሉ"`
  2. `config/locales/am.yml:6` (`actions.pay_with_chapa`): `"በቻፓ ይክፈሉ"`
  3. `app/javascript/locales/am/checkout.ts:14` (`checkout.processing`): `"በቻፓ ክፍያ በማስኬድ ላይ..."`
  4. `app/javascript/locales/am/checkout.ts:18` (`checkout.redirecting`): `"ወደ ቻፓ ክፍያ በማዛወር ላይ..."`
  5. `config/locales/am.yml:64` (`checkout.processing`): `"በቻፓ ክፍያ በማስኬድ ላይ..."`
  6. `config/locales/am.yml:68` (`checkout.redirecting`): `"ወደ ቻፓ ክፍያ በማዛወር ላይ..."`
  7. `app/javascript/locales/am/errors.ts:7` (`errors.card_declined_chapa`): `"ካርድዎ ተቀባይነት አላገኘም። እባክዎ ሌላ ካርድ ይጠቀሙ ወይም በ Chapa ይክፈሉ።"`

### E. Independent Creators / Sellers: ራሳቸውን የቻሉ ሻጮች vs ከተናጠል

- **Decision**: Standardized on **ራሳቸውን የቻሉ ሻጮች** (or **የግል ሻጮች**) for "independent creators / sellers" (e.g., `discover.hero_title` and `discover.seo_title`: `"ራሳቸውን ከቻሉ ሻጮች የዲጂታል ምርቶችን ያግኙ"`).
- **Rationale**: Replaces **ከተናጠል** and **ፈጣሪዎች**. In Amharic, **ተናጠል** describes discrete, isolated objects or units (e.g., items sold separately), which sounds awkward and dehumanizing when applied to creative individuals. **ራሳቸውን የቻሉ** directly and elegantly expresses autonomy, self-reliance, and independence.
- **Applied**: Enforced by automated glossary compliance checks in `parity.test.ts` and `localization_parity_spec.rb`.
