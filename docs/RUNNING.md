# Running ArifDrop with Chapa Checkout

This guide covers configuring and running ArifDrop with Chapa payment processing in development, testing, and production.

## Environment Variables

Payment credentials are configured strictly via environment variables or Rails credentials. Secret keys are never printed, committed, or exposed.

| Variable               | Description                                                                                 | Example / Format                 |
| ---------------------- | ------------------------------------------------------------------------------------------- | -------------------------------- |
| `CHAPA_SECRET_KEY`     | Merchant API secret key. Must start with `CHASECK_TEST-` in dev/test, and live key in prod. | `CHASECK_TEST-xxxxxxxxxxxxxxxx`  |
| `CHAPA_WEBHOOK_SECRET` | Secret hash set in the Chapa merchant dashboard for webhook HMAC-SHA256 signatures.         | `my_webhook_secret_hash_32chars` |
| `CHAPA_PUBLIC_KEY`     | Public key used for client integrations (optional).                                         | `CHAPUBK_TEST-xxxxxxxxxxxxxxxx`  |
| `CHAPA_API_URL`        | Base API URL (defaults to `https://api.chapa.co`).                                          | `https://api.chapa.co`           |
| `CANONICAL_HOST`       | Canonical hostname for callbacks and webhooks in local multi-domain setups.                 | `arifdrop.test:3000`             |
| `TUNNEL_HOST`          | Hostname of tunnel (ngrok or cloudflared) for webhook delivery in dev.                      | `abc-123.ngrok-free.app`         |

## Diagnostics & Readiness

Run `bin/doctor` to verify your environment, database, Redis, and Chapa configuration:

```bash
bin/doctor
```

### Key Security Boot Rules

1. **Production Boot Check**: If `RAILS_ENV=production` and `CHAPA_SECRET_KEY` starts with `CHASECK_TEST`, the application will refuse to boot (`PlatformConfig.validate_production_config!`).
2. **Development Warning**: If `RAILS_ENV=development` and a live Chapa key is detected, a warning is logged alerting the developer to switch to test keys.

## Local Development & Webhook Tunneling

1. Start development services:
   ```bash
   bin/dev
   ```
2. Start Sidekiq for background webhook and reconciliation jobs:
   ```bash
   bundle exec sidekiq
   ```
3. Expose your local port to receive Chapa webhooks using the included tunnel helper:
   ```bash
   bin/tunnel 3000
   ```
4. Set the Webhook URL in your Chapa Dashboard (https://dashboard.chapa.co/settings/webhooks):
   - **URL**: `https://<tunnel-domain>/webhooks/chapa`
   - **Secret Hash**: Enter a secret passphrase and set `CHAPA_WEBHOOK_SECRET` to the exact same value.

## Background Jobs

- `Chapa::ReconcilePendingTransactionsJob`: Runs every 5 minutes (`*/5 * * * *`) via Sidekiq Cron to verify pending transactions older than 5 minutes directly with the Chapa gateway.
- `Chapa::ExpireAbandonedTransactionsJob`: Runs every 15 minutes (`*/15 * * * *`) to reconcile and expire abandoned transactions older than 60 minutes.
- `Chapa::ProcessWebhookJob`: Asynchronously processes incoming Chapa webhook events stored in `chapa_webhook_events`.
- `Chapa::PollRefundStatusJob`: Periodically checks status of pending Chapa refunds until terminal state (`refunded` or `reversed`).
