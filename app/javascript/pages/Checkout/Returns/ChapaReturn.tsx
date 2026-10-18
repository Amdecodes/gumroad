import { AlertCircle, CheckCircle, Clock, XCircle } from "@boxicons/react";
import * as React from "react";

import { t } from "$app/utils/i18n";

import { Button } from "$app/components/Button";
import { LoadingSpinner } from "$app/components/LoadingSpinner";
import { Card, CardContent } from "$app/components/ui/Card";

export type ChapaReturnProps = {
  orderId: string;
  statusUrl: string;
  productName?: string;
  priceFormatted?: string;
  sellerName?: string;
};

type PaymentStatus = "pending" | "success" | "failed" | "cancelled" | "expired" | "timeout";

const POLL_INTERVAL_MS = 2_000;
const GIVE_UP_TIMEOUT_MS = 90_000; // 90 seconds timeout

export default function ChapaReturn({ orderId, statusUrl, productName, priceFormatted, sellerName }: ChapaReturnProps) {
  const [status, setStatus] = React.useState<PaymentStatus>("pending");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    const startedAt = Date.now();

    const checkStatus = async () => {
      if (!active) return;

      if (Date.now() - startedAt >= GIVE_UP_TIMEOUT_MS) {
        setStatus("timeout");
        return;
      }

      try {
        const response = await fetch(statusUrl, {
          headers: {
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            setStatus("failed");
            setErrorMessage("Order not found");
            return;
          }
          // On non-404 network or 5xx error, retry on next interval
          if (active) {
            setTimeout(checkStatus, POLL_INTERVAL_MS);
          }
          return;
        }

        const data = await response.json();
        if (!active) return;

        const serverStatus = data.status;

        if (serverStatus === "success") {
          setStatus("success");
          const targetUrl = data.redirect_url;
          if (targetUrl) {
            setRedirectUrl(targetUrl);
            setTimeout(() => {
              window.location.replace(targetUrl);
            }, 1000);
          }
          return;
        }

        if (serverStatus === "failed") {
          setStatus("failed");
          setErrorMessage(data.error_message || null);
          return;
        }

        if (serverStatus === "cancelled") {
          setStatus("cancelled");
          return;
        }

        if (serverStatus === "expired") {
          setStatus("expired");
          return;
        }

        // Still pending
        if (active) {
          setTimeout(checkStatus, POLL_INTERVAL_MS);
        }
      } catch {
        if (active) {
          setTimeout(checkStatus, POLL_INTERVAL_MS);
        }
      }
    };

    checkStatus();

    return () => {
      active = false;
    };
  }, [statusUrl]);

  return (
    <div className="mx-auto my-8 max-w-2xl px-4">
      <Card>
        <CardContent asChild>
          <header className="border-b border-border p-6">
            <div className="flex items-center gap-3">
              {status === "pending" && <LoadingSpinner className="size-6 text-primary" />}
              {status === "success" && <CheckCircle className="size-6 text-success" />}
              {status === "failed" && <XCircle className="size-6 text-danger" />}
              {status === "cancelled" && <XCircle className="size-6 text-muted" />}
              {status === "expired" && <Clock className="size-6 text-warning" />}
              {status === "timeout" && <AlertCircle className="size-6 text-warning" />}

              <h2 className="text-xl font-bold">
                {status === "pending" && t("checkout.chapa_verifying_title")}
                {status === "success" && t("checkout.chapa_success_title")}
                {status === "failed" && t("checkout.chapa_failed_title")}
                {status === "cancelled" && t("checkout.chapa_cancelled_title")}
                {status === "expired" && t("checkout.chapa_expired_title")}
                {status === "timeout" && t("checkout.chapa_timeout_title")}
              </h2>
            </div>
          </header>
        </CardContent>

        <CardContent className="space-y-4 p-6">
          <p className="text-muted">
            {status === "pending" && t("checkout.chapa_verifying_desc")}
            {status === "success" && t("checkout.chapa_success_desc")}
            {status === "failed" && (errorMessage || t("checkout.chapa_failed_desc"))}
            {status === "cancelled" && t("checkout.chapa_cancelled_desc")}
            {status === "expired" && t("checkout.chapa_expired_desc")}
            {status === "timeout" && t("checkout.chapa_timeout_desc")}
          </p>

          <div className="rounded border border-border bg-body p-4 text-sm">
            <div className="font-semibold text-muted">{t("checkout.chapa_order_details")}</div>
            {orderId ? <div className="mt-1 font-mono text-xs text-muted">ID: {orderId}</div> : null}
            {productName ? <div className="mt-1 font-medium text-foreground">{productName}</div> : null}
            {priceFormatted ? <div className="mt-0.5 text-muted">{priceFormatted}</div> : null}
            {sellerName ? <div className="mt-0.5 text-xs text-muted">by {sellerName}</div> : null}
          </div>

          <div className="pt-2">
            {status === "success" && redirectUrl ? (
              <Button color="primary" onClick={() => window.location.replace(redirectUrl)}>
                {t("checkout.chapa_success_title")}
              </Button>
            ) : null}

            {(status === "failed" || status === "cancelled" || status === "expired" || status === "timeout") && (
              <div className="flex gap-3">
                <Button color="primary" onClick={() => window.history.back()}>
                  {t("checkout.chapa_retry_button")}
                </Button>
                <Button
                  outline
                  onClick={() => {
                    window.location.href = "/";
                  }}
                >
                  {t("checkout.chapa_return_to_store")}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

ChapaReturn.publicLayout = true;
