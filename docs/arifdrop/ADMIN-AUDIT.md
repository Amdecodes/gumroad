# ArifDrop Admin & Super-Admin Functionality Audit

**Project**: ArifDrop (Gumroad fork for Ethiopia)  
**Date**: October 2026  
**Auditor**: Antigravity Assistant  
**Repository Baseline**: `antiwork/gumroad` (`cc4d616c7`)

---

## 1. Executive Summary

Gumroad’s administrative architecture has undergone an important architectural evolution: **the legacy Rails HTML admin dashboard was completely removed**.

Today, all platform management, seller compliance, fraud screening, payout handling, refund processing, and moderation operate through a secure, token-authenticated **Internal Admin REST API** (`/api/internal/admin/*`) consumed by the `gumroad-admin` command-line tool (and internal automation scripts). The only web-accessible admin interfaces remaining in Rails are **Flipper UI** (`/admin/features`) and **Sidekiq Web** (`/admin/sidekiq`).

For ArifDrop in Ethiopia:

- The internal admin REST API provides a complete, robust management backend that can be consumed by CLI scripts or a modern admin web frontend.
- Payout and compliance endpoints will serve as the primary operational hub for manual Ethiopian bank / Telebirr disbursements.
- Flipper UI gives immediate GUI control over feature rollouts without requiring code deployments.

---

## 2. Admin Routes Architecture

### 2.1 Web Routes (`config/routes/admin.rb`)

```ruby
namespace :admin do
  get :impersonate, to: "base#impersonate"
  delete :unimpersonate, to: "base#unimpersonate"
  get :redirect_to_stripe_dashboard, to: "base#redirect_to_stripe_dashboard", as: :redirect_to_stripe_dashboard

  constraints(lambda { |request| request.env["warden"].authenticate? && request.env["warden"].user.is_team_member? }) do
    mount SidekiqWebCSP.new(Sidekiq::Web) => :sidekiq, as: :sidekiq_web
    mount FlipperCSP.new(Flipper::UI.app(Flipper)) => :features, as: :flipper_ui
  end
end
```

- Protected by Warden session authentication and `User#is_team_member?`.
- `/admin/features`: Flipper web GUI for toggling flags on actors, groups, or percentages.
- `/admin/sidekiq`: Sidekiq job queues, retry sets, scheduled jobs, and dead letters.
- `/admin/impersonate`: Allows team members to temporarily sign in as any user for customer support.

---

## 3. Internal Admin API (`/api/internal/admin/*`)

All internal admin APIs inherit from `Api::Internal::Admin::BaseController` (`app/controllers/api/internal/admin/base_controller.rb`).

### 3.1 Authentication & Security

- **Authentication**: Bearer token via `Authorization: Bearer <token>`.
- **Token Model**: `AdminApiToken` (`app/models/admin_api_token.rb`). Validates expiration, active status, and scope (`required_token_scope = AdminApiToken::ADMIN_SCOPE`).
- **Actor Attribution**: `set_current_admin_actor!(admin_api_token.actor_user)`. All writes record the specific team member's ID in `Current.admin_actor`.
- **Audit Logging**: Every mutating action is wrapped in `record_admin_write(action:, target:)`, which logs actor ID, action name, target record, and parameters with automated redaction of passwords, tokens, and secrets (`ADMIN_AUDIT_REDACTED_PARAM_PATTERN`).

---

### 3.2 User Management & Compliance (`Api::Internal::Admin::UsersController`)

Located in `app/controllers/api/internal/admin/users_controller.rb` (51 KB):

| Endpoint                                              | HTTP Method | Action & Purpose                                                                                                  |
| :---------------------------------------------------- | :---------- | :---------------------------------------------------------------------------------------------------------------- |
| `/api/internal/admin/users/info`                      | `GET`       | Comprehensive user inspection: account age, total sales, balance, email, phone, risk state, active bank accounts. |
| `/api/internal/admin/users/compliance_info`           | `GET`       | Creator KYC data: national ID, business registration, country, address, tax information.                          |
| `/api/internal/admin/users/mark_compliant`            | `POST`      | Approves a seller for automated or manual payouts (`user.update!(compliant: true)`).                              |
| `/api/internal/admin/users/suspend_for_fraud`         | `POST`      | Immediately suspends user, unpublishes all products, holds balances, cancels active subscriptions.                |
| `/api/internal/admin/users/suspend_for_tos_violation` | `POST`      | Suspends user for policy breaches (e.g. copyright, prohibited goods).                                             |
| `/api/internal/admin/users/flag_for_tos_violation`    | `POST`      | Applies warning flag and payout probation without immediate account termination.                                  |
| `/api/internal/admin/users/refund_all_for_fraud`      | `POST`      | Mass-refunds all buyers associated with a fraudulent seller.                                                      |
| `/api/internal/admin/users/refund_balance`            | `POST`      | Clears or adjusts outstanding seller balances.                                                                    |
| `/api/internal/admin/users/watch`, `unwatch`          | `POST`      | Adds creator to high-risk observation queue.                                                                      |
| `/api/internal/admin/users/reset_password`            | `POST`      | Triggers password reset instructions for locked accounts.                                                         |
| `/api/internal/admin/users/update_email`              | `POST`      | Administrative email change with security logging.                                                                |
| `/api/internal/admin/users/two_factor_authentication` | `POST`      | Disables or resets 2FA for users locked out of TOTP authenticators.                                               |

---

### 3.3 Payments & Purchases (`Api::Internal::Admin::PurchasesController`)

Located in `app/controllers/api/internal/admin/purchases_controller.rb` (22 KB):

| Endpoint                                                | HTTP Method | Action & Purpose                                                                          |
| :------------------------------------------------------ | :---------- | :---------------------------------------------------------------------------------------- |
| `/api/internal/admin/purchases/lookup`                  | `GET`       | Lookup purchase by purchase ID, external ID, email, or invoice number.                    |
| `/api/internal/admin/purchases/search`                  | `GET`       | Filter purchases by seller, buyer, date range, currency, and risk score.                  |
| `/api/internal/admin/purchases/:id/refund`              | `POST`      | Executes admin full or partial refund.                                                    |
| `/api/internal/admin/purchases/:id/refund_taxes`        | `POST`      | Tax-only refund for tax-exempt entities or calculation disputes.                          |
| `/api/internal/admin/purchases/:id/refund_for_fraud`    | `POST`      | Fraud-flagged refund that also trains internal risk heuristics.                           |
| `/api/internal/admin/purchases/:id/cancel_subscription` | `POST`      | Forces administrative termination of a customer subscription.                             |
| `/api/internal/admin/purchases/:id/block_buyer`         | `POST`      | Blacklists buyer email and card fingerprint across the platform.                          |
| `/api/internal/admin/purchases/:id/reassign`            | `POST`      | Moves a purchase to a different buyer account (e.g. if buyer mistyped email at checkout). |
| `/api/internal/admin/purchases/:id/resend_receipt`      | `POST`      | Re-delivers purchase receipt and digital download link to buyer.                          |

---

### 3.4 Payouts & Scheduled Batches

Located in `app/controllers/api/internal/admin/payouts_controller.rb` and `scheduled_payouts_controller.rb`:

| Endpoint                                            | HTTP Method | Action & Purpose                                                                    |
| :-------------------------------------------------- | :---------- | :---------------------------------------------------------------------------------- |
| `/api/internal/admin/payouts`                       | `GET`       | Lists creator payout history, current balance, and payout pause status.             |
| `/api/internal/admin/payouts/pause`                 | `POST`      | Pauses payouts for a specific user with mandatory internal reason note.             |
| `/api/internal/admin/payouts/resume`                | `POST`      | Resumes payouts and logs release of hold.                                           |
| `/api/internal/admin/payouts/issue`                 | `POST`      | Manually triggers immediate payout generation for an account up to a specific date. |
| `/api/internal/admin/scheduled_payouts`             | `GET`       | Inspects pending scheduled payout batches (`due`, `held`, `executed`, `flagged`).   |
| `/api/internal/admin/scheduled_payouts/:id/execute` | `POST`      | Forces execution of a scheduled payout batch.                                       |
| `/api/internal/admin/scheduled_payouts/:id/cancel`  | `POST`      | Cancels a queued payout batch.                                                      |

---

### 3.5 Product Moderation & Piracy

Located in `app/controllers/api/internal/admin/products_controller.rb` and `piracy_reports_controller.rb`:

- `GET /api/internal/admin/products`: Search products by permalink, seller, name, or price.
- `GET /api/internal/admin/products/:id/files/:file_id/download_url`: Allows admin to securely inspect uploaded digital assets.
- `GET /api/internal/admin/piracy_reports`: DMCA and copyright infringement intake queue.
- `POST /api/internal/admin/piracy_reports/:id/screen`: Review, take down infringing products, or dismiss report.

---

### 3.6 Support & Email Delivery Tooling

- `Api::Internal::Admin::StrandedBuyersController`: Scans for purchases where payment completed but buyer account association broke; provides one-click recovery.
- `Api::Internal::Admin::SendgridEmailsController`: Checks whether a buyer/seller email address was bounced or suppressed by SendGrid; provides one-click unblock.
- `Api::Internal::Admin::LicensesController`: Looks up software license keys, usage counts, and associated sales.

---

## 4. Feature Flag System (`lib/utilities/feature.rb`)

Gumroad implements feature toggling via **Flipper** (`gem "flipper"`, `gem "flipper-active_record"`, `gem "flipper-redis"`):

```ruby
module Feature
  def activate(feature_name)
    Flipper.enable(feature_name)
  end

  def activate_user(feature_name, user)
    Flipper.enable_actor(feature_name, user)
  end

  def activate_percentage(feature_name, percentage)
    Flipper.enable_percentage_of_actors(feature_name, percentage)
  end

  def active?(feature_name, actor = nil)
    Flipper.enabled?(feature_name, actor)
  end
end
```

### Key Flags Available for ArifDrop:

- `store_agent_*`: Can be globally disabled with `Feature.deactivate(:store_agent)`.
- `membership_renewal_reminders`: Controls automated subscription renewal reminder dispatch.
- `auto_marketing`: Gates marketing automations.

---

## 5. ArifDrop Admin Recommendations

1. **Leverage the Admin API for Operations**:  
   Since Gumroad’s core logic already lives in `/api/internal/admin/*`, ArifDrop does not need to build admin APIs from scratch. A simple administrative dashboard (or Retool / Next.js / CLI app) can consume these exact endpoints.
2. **Adapt `/payouts/issue` for Ethiopia**:  
   Line 100 of `payouts_controller.rb` currently enforces:
   ```ruby
   unless PayoutProcessorType.all.include?(processor_param)
     return render json: { success: false, message: "payout_processor must be stripe or paypal" }
   end
   ```
   Add a `MANUAL` / `ETHIO_BANK` payout processor type so administrators can mark batches as exported or completed for domestic bank transfers.
3. **Use Flipper for Zero-Downtime Rollouts**:  
   Use `/admin/features` to manage feature toggles across sellers in Addis Ababa and regional hubs.
