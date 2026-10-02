# ArifDrop Internationalization & Localization Audit

**Project**: ArifDrop (Gumroad fork for Ethiopia)  
**Date**: October 2026  
**Auditor**: Antigravity Assistant  
**Repository Baseline**: `antiwork/gumroad` (`cc4d616c7`)

---

## 1. Executive Summary

Gumroad was built almost exclusively for an English-first global audience. There is **no client-side internationalization framework** in place, and the Rails I18n backend contains almost zero application translations. Every single customer-facing and creator-facing interface is hard-coded in English.

For ArifDrop to serve Ethiopian buyers and creators effectively:

1. **Typography**: The primary web font (`ABC Favorit`) does not contain Ethiopic glyphs; a fallback font like `Noto Sans Ethiopic` must be added.
2. **Currency**: ETB (Ethiopian Birr / ብር) must be configured in `config/currencies.json` and supported across all pricing formatters.
3. **Directionality**: Ethiopic (Ge'ez script) is **Left-to-Right (LTR)**, so no RTL layout inversion is needed.
4. **Localization Strategy**: Rather than translating the entire complex seller dashboard on day one, ArifDrop should prioritize translating the **critical buyer-facing checkout and receipt paths** into Amharic (and optionally Afaan Oromoo).

---

## 2. Translation System & Locale Files

### 2.1 Backend (Rails I18n)

- **Status**: Skeleton only.
- **Evidence**: `config/locales/` contains only **one** file: `devise.en.yml` (9 lines), defining two Devise alert messages.
- **Code Reference**:
  ```yaml
  # config/locales/devise.en.yml
  en:
    devise:
      mailer:
        email_changed:
          subject: "Security alert: Your Gumroad account email is being changed"
    errors:
      messages:
        pwned_password: has previously appeared in a data breach...
  ```
- No models, controllers, or mailers use `I18n.t(...)` for user-facing copy. All flash messages, validations, and email bodies are raw English string literals.

### 2.2 Frontend (React / TypeScript / Inertia)

- **Status**: Completely absent.
- **Evidence**: `package.json` contains no i18n libraries (no `react-i18next`, no `react-intl`, no `@formatjs/intl`).
- All React components directly render English JSX strings (e.g. `<Button>Pay</Button>`, `"Card number"`, `"Discount code"`).

---

## 3. Buyer-Facing Flows with Hardcoded English

Every major buyer touchpoint contains hardcoded English strings:

| User Flow                   | Key Component Files                                                             | Hardcoded English Examples                                                                                |
| :-------------------------- | :------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------- |
| **Product Landing Page**    | `app/javascript/components/ProductPage.tsx`, `ProductCard.tsx`                  | `"Buy this"`, `"Pay what you want"`, `"Quantity"`, `"Ratings & reviews"`, `"Ratings"`                     |
| **Checkout Form**           | `app/javascript/components/Checkout/PaymentForm.tsx`, `CreditCardInput.tsx`     | `"Email address"`, `"Card information"`, `"Pay"`, `"Pay with PayPal"`, `"Discount code"`, `"Postal code"` |
| **Gifting Flow**            | `app/javascript/components/Checkout/GiftForm.tsx`                               | `"Give as a gift"`, `"Recipient's email"`, `"Gift message"`                                               |
| **Order Receipt & Library** | `app/javascript/components/Checkout/Receipt.tsx`, `TemporaryLibrary.tsx`        | `"You got it!"`, `"Receipt"`, `"View content"`, `"Download"`, `"Invoice"`                                 |
| **Media Player**            | `app/javascript/components/AudioPlayer.tsx`, `VideoPlayer.tsx`                  | `"Listen"`, `"Stream"`, `"Speed"`, `"Subtitles"`                                                          |
| **Email Receipts**          | `app/views/customer_mailer/charge_receipt.html.erb`                             | `"Here's your receipt for..."`, `"View your content"`, `"Manage subscription"`                            |
| **Subscription Notices**    | `app/views/customer_low_priority_mailer/subscription_renewal_reminder.html.erb` | `"Your subscription renews soon"`, `"Your card will be charged"`                                          |

---

## 4. Currency Formatting Architecture

### 4.1 Backend Currency Engine

- **Module**: `MoneyFormatter` (`app/modules/money_formatter.rb`)
- **Helper**: `CurrencyHelper` (`app/helpers/currency_helper.rb`)
- **Underlying Gem**: `money` (supports ISO-4217 `ETB`).
- **Data Source**: `config/currencies.json` and `app/business/payments/currency.rb`.

### 4.2 The ETB Gap in Gumroad

In `app/business/payments/currency.rb`:

- Currencies from `CURRENCY_CHOICES` (`config/currencies.json`) are allowed as default pricing currencies.
- `ETB` is explicitly isolated in lines 10-60 as a payout-only currency:
  ```ruby
  # These currencies are only used for creating Stripe Connect accounts and making payouts.
  # These cannot be used as account's default currency or to set product prices.
  ETB = "etb"
  ```
- **Action Required for ArifDrop**: Add ETB to `config/currencies.json`:
  ```json
  "etb": {
    "symbol": "Br",
    "display_format": "Br (Ethiopian Birr)",
    "short_symbol": "Br",
    "min_price": 1000
  }
  ```

### 4.3 Frontend Currency Formatting

- **File**: `app/javascript/utils/currency.ts`
- Derives `CurrencyCode` type dynamically from `config/currencies.json`:
  ```typescript
  export type CurrencyCode = keyof typeof currenciesMap;
  ```
  Once `config/currencies.json` contains `"etb"`, the TypeScript compiler and UI selectors will automatically validate and display ETB.

---

## 5. Date, Time & Number Formatting

### 5.1 Date & Time Formats

- Defined in `config/initializers/time_formats.rb`:
  - `:long_formatted_datetime` = `"%e %b %Y %l:%M %p"` (e.g. ` 1 Oct 2026 1:45 PM`)
  - `:formatted_date_full_month` = `"%B %-d, %Y"` (e.g. `October 1, 2026`)
  - `:formatted_date_abbrev_month` = `"%b %-d, %Y"` (e.g. `Oct 1, 2026`)
  - `:slashed` = `%-m/%-d/%Y` (e.g. `10/1/2026`)
- **Ethiopian Context**:
  - The Ethiopian calendar (Ge'ez calendar) has 13 months (Meskerem through Pagume) and is 7–8 years behind the Gregorian calendar.
  - While Ethiopian financial institutions (banks, Telebirr) accept Gregorian dates for digital receipts, presenting localized Amharic month names or dual-calendar displays greatly improves local trust.

### 5.2 Number Formatting

- Uses standard US English thousands comma separator (e.g. `1,500.00`).
- Ethiopia follows standard Arabic-decimal notation (`1,500.00 ብር` or `ETB 1,500.00`). Traditional Ge'ez numeral notation (፩, ፪, ፫, ፲) is generally not used for modern commercial pricing.

---

## 6. Directionality (LTR vs RTL)

- **Amharic (አማርኛ)** and other Ethiopian languages using the Ethiopic / Ge'ez script (Tigrinya, Gurage, Blin) are written **Left-to-Right (LTR)**.
- Latin-script Ethiopian languages (Afaan Oromoo, Somali) are also LTR.
- **Auditing Finding**: No RTL layout inversion, CSS mirroring, or flex-direction swapping is needed for Ethiopian localization.

---

## 7. Typography & Font Stack Analysis

### 7.1 Current Typography Stack

In `app/javascript/stylesheets/_font.scss`:

```scss
@font-face {
  font-family: "ABC Favorit";
  src: url("/fonts/ABCFavorit-Regular.woff2");
}
```

In `app/javascript/stylesheets/tailwind.css`:

```css
font-family:
  "ABC Favorit",
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  Roboto,
  Helvetica,
  Arial,
  sans-serif;
```

### 7.2 Glyph Coverage Problem

- `ABC Favorit` is a Latin sans-serif font. It contains **no Ethiopic Unicode characters** (Unicode range `U+1200` to `U+137F`, `U+1380` to `U+139F`, `U+2D80` to `U+2DDF`, `U+AB00` to `U+AB2F`).
- When Amharic characters (e.g. "ይግዙ", "ብር", "ሰላም") are rendered:
  - If the OS has a system Ethiopic font (like `Nyala` on Windows or `Kefa` on macOS), the browser falls back to it.
  - On Linux or mobile Android without standard fallback, glyphs can appear distorted, mismatched in line height, or as tofu blocks (□).

### 7.3 Font Recommendation for ArifDrop

Add **Noto Sans Ethiopic** (Google Fonts / open source) to the web font declarations and prepend it in the Tailwind font family:

```css
font-family:
  "ABC Favorit",
  "Noto Sans Ethiopic",
  -apple-system,
  BlinkMacSystemFont,
  sans-serif;
```

---

## 8. High-Priority Areas for Amharic Localization in ArifDrop

For an efficient MVP rollout, localization should be implemented in three focused phases:

### Phase 1: Buyer Checkout & Payment (Essential)

1. **Payment Form Buttons & Prompts**:
   - "Pay" -> "ይክፈሉ"
   - "Pay with Telebirr" -> "በቴሌብር ይክፈሉ"
   - "Pay with CBE Birr" -> "በሲቢኢ ብር ይክፈሉ"
   - "Email address" -> "የኢሜይል አድራሻ"
   - "Phone number" -> "ስልክ ቁጥር"
2. **Error Messages**:
   - "Payment failed" -> "ክፍያው አልተሳካም"
   - "Please enter a valid phone number" -> "ትክክለኛ ስልክ ቁጥር ያስገቡ"
3. **Receipt & Content Delivery**:
   - "Your purchase was successful" -> "ግዢዎ በተሳካ ሁኔታ ተጠናቋል"
   - "Download" -> "አውርድ"

### Phase 2: Transactional Emails & SMS

1. Purchase confirmation receipt email / SMS.
2. Subscription monthly renewal reminder notice with payment link.
3. Creator payout completion notice.

### Phase 3: Seller Dashboard (Secondary)

1. Product creation screens.
2. Analytics and sales tables.
3. Profile builder settings.
