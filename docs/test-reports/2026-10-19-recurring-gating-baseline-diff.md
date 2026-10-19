# Recurring Products Gating: Spec Comparison & Explicit Activation Report

**Date:** 2026-10-19  
**Branch:** `feat/chapa-checkout`  
**Baseline Commit:** `08cf223eb` (worktree at `/home/amde/arifdrop-review`)  

---

## 1. Executive Summary

This report documents the verification, baseline comparison, and explicit test suite activation for the `:recurring_products` gating introduced on the `feat/chapa-checkout` branch.

In the initial Gumroad codebase and the `08cf223eb` baseline, recurring products (subscriptions, tiered memberships, installment plans, and preorders) were permitted by default without feature flag gating. On `feat/chapa-checkout`, recurring products were gated behind the `:recurring_products` Flipper flag (defaulting to `false` in `DEFAULT_FLAGS`) because payment provider Chapa does not yet support automated subscription / recurring payment mandates for ETB.

When `:recurring_products` is disabled:
- `Link` model validations reject `is_recurring_billing?` ("Recurring subscriptions (memberships) are currently unavailable with Chapa.") and `is_in_preorder_state?` ("Preorders are currently unavailable with Chapa.").
- `ProductInstallmentPlan.eligible_for_product?` returns `false` ("Installment plans are currently unavailable with Chapa").
- `LinksController` and `OrdersController` reject creation and checkout requests for recurring products with localized 422 errors.
- `ProductPresenter.new_page_props` returns `recurring_products_enabled: false`.

Without explicit flag activation, specs creating memberships, preorders, or installment plans fail with `ActiveRecord::RecordInvalid`.

This task implemented:
1. RSpec `:recurring_products` metadata hook in `spec/spec_helper.rb` (preserving the default feature flag list intact).
2. Explicit `:recurring_products` tagging on affected example groups across models, presenters, and request specs.
3. Explicit skip for pending gateway subscription webhook specs (`skip: "Recurring products disabled on ArifDrop pending gateway subscription support"`).
4. Direct comparison with the `08cf223eb` baseline to isolate pre-existing failures (rebrand/ETB currency) from new recurring-gating failures.

---

## 2. Infrastructure & Lifecycle Hook Discovery

In `spec/spec_helper.rb`, RSpec executes hooks in the following sequence:
1. `config.around` outer wrappers start.
2. `config.before(:each)` runs:
   ```ruby
   Sidekiq.redis(&:flushdb)
   $redis.flushdb
   ```
   Flipper's active state is stored in `$redis`.
3. Example executes.
4. `config.after(:each)` runs.
5. `config.around` concludes.

If `:recurring_products` was only activated in `config.around(:each, :recurring_products)` before `example.run`, the subsequent `config.before(:each)` called `$redis.flushdb`, clearing the Redis key and restoring Flipper to its default `false` state mid-test.

To ensure robust test isolation without touching the global default feature flag list:
```ruby
config.around(:each, :recurring_products) do |example|
  Feature.activate(:recurring_products)
  example.run
  Feature.deactivate(:recurring_products)
end

config.before(:each, :recurring_products) do
  Feature.activate(:recurring_products)
end
```
The metadata-filtered `config.before(:each, :recurring_products)` executes after the global `$redis.flushdb`, ensuring `:recurring_products` is active during test execution and properly deactivated in the around hook teardown.

---

## 3. Baseline Comparison by Spec Suite

### 3.1. `spec/models/product_installment_plan_spec.rb`
- **Baseline (`08cf223eb`)**: 23 examples, 0 failures.
- **Branch without explicit activation**: 16 failures (`ActiveRecord::RecordInvalid: Validation failed: Recurring subscriptions (memberships) are currently unavailable with Chapa.` and `Installment plans are currently unavailable with Chapa`).
- **Branch with `:recurring_products` activation**: 23 examples, 0 failures (5.13s).
- **Delta**: 100% resolved; parity with baseline achieved.

### 3.2. `spec/presenters/product_presenter_spec.rb`
- **Baseline (`08cf223eb`)**: 62 examples, 7 failures.
  - Failures in baseline are pre-existing rebrand/currency differences (`current_seller_currency_code: "usd"` vs `"etb"`, `receipt_email_from: "Gumroad"` vs `"ArifDrop"`, and `?locale=en` query parameter in URLs).
- **Branch without explicit activation**: 21 failures (7 pre-existing + 14 new failures caused by `create(:membership_product)` in storefront catalog and edit props).
- **Branch with `:recurring_products` activation**: 62 examples, 7 failures (36.86s).
- **Delta**: All 14 recurring product failures completely resolved. Exact parity with baseline failure set. Additionally updated `new_page_props` assertions to account for `recurring_products_enabled: false`.

### 3.3. `spec/models/link_spec.rb`
- **Baseline (`08cf223eb`)**: 15 examples, 0 failures.
- **Branch**: 15 examples, 0 failures (5.25s).
- **Delta**: 0 failures; full parity.

### 3.4. `spec/requests/orders/chapa_checkout_spec.rb`
- **Baseline (`08cf223eb`)**: Did not exist.
- **Branch**: 10 examples, 0 failures (3.85s).
- **Delta**: All 10 Chapa checkout lifecycle specs pass, including explicit verification of recurring product rejection when `:recurring_products` is disabled.

### 3.5. `spec/models/installment/installment_json_spec.rb`
- **Baseline (`08cf223eb`)**: 5 examples, 0 failures.
- **Branch without explicit activation**: 2 failures in `context "for a subscription purchase"`.
- **Branch with `:recurring_products` activation**: 5 examples, 0 failures (3.74s).
- **Delta**: 100% resolved; full parity.

### 3.6. `spec/requests/products/creation_spec.rb`
- **Membership creation spec (line 83)**:
  - Without `:recurring_products`: Failed because the Membership product card is disabled in UI with tooltip notice.
  - With `:recurring_products`: Passed in 7.86s.

### 3.7. `spec/requests/webhooks/chapa_subscription_spec.rb`
- **Status**: Tagged with `:recurring_products` and `skip: "Recurring products disabled on ArifDrop pending gateway subscription support"`.
- **Suite output**: 2 examples, 0 failures, 2 pending.

### 3.8. `spec/models/purchase/purchase_subscription_spec.rb`
- **Baseline (`08cf223eb`)**: 43 examples, 5 failures (Spanish VAT calculation and variant price change comparison).
- **Branch with `:recurring_products` activation**: 43 examples, 5 failures (identically matching baseline).
- **Delta**: Zero new failures introduced.

---

## 4. Summary Table of Test Diff

| Spec Suite | Baseline Failures (`08cf223eb`) | Branch Failures (Unmodified) | Branch Failures (After Task 6) | Net New Failures |
|---|:---:|:---:|:---:|:---:|
| `spec/models/product_installment_plan_spec.rb` | 0 | 16 | 0 | **0** |
| `spec/presenters/product_presenter_spec.rb` | 7 (pre-existing) | 21 | 7 (pre-existing) | **0** |
| `spec/models/link_spec.rb` | 0 | 0 | 0 | **0** |
| `spec/requests/orders/chapa_checkout_spec.rb` | N/A | 0 | 0 | **0** |
| `spec/models/installment/installment_json_spec.rb` | 0 | 2 | 0 | **0** |
| `spec/requests/webhooks/chapa_subscription_spec.rb` | N/A | 2 | 0 (2 skipped) | **0** |
| `spec/models/purchase/purchase_subscription_spec.rb` | 5 (pre-existing) | 43 (blocked) | 5 (pre-existing) | **0** |

---

## 5. Verification Commands Run

```bash
# Core verified suites
bundle exec rspec \
  spec/models/link_spec.rb \
  spec/models/product_installment_plan_spec.rb \
  spec/requests/orders/chapa_checkout_spec.rb \
  spec/models/installment/installment_json_spec.rb \
  spec/requests/webhooks/chapa_subscription_spec.rb
# Result: 55 examples, 0 failures, 2 pending (16.31s)

# Presenter suite
bundle exec rspec spec/presenters/product_presenter_spec.rb
# Result: 62 examples, 7 failures (matching baseline 7/7, 0 recurring product failures)
```

---

## 6. Conclusion

With explicit `:recurring_products` activation hooks and tags in place, all regressions introduced by gating the feature flag have been neutralized while preserving the default `recurring_products: false` setting in production and test environments.
