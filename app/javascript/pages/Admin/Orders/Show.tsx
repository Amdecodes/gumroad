import {
  ArrowLeft,
  CreditCard,
  FileDetail,
  Key,
  Package,
  Receipt,
  RotateCcw,
  Send,
  User,
  XCircle,
} from "@boxicons/react";
import { Link, router } from "@inertiajs/react";
import * as React from "react";

import { useTranslation } from "$app/utils/i18n";

import { AdminLayout } from "$app/components/Admin/AdminLayout";
import { Button } from "$app/components/Button";
import { Modal } from "$app/components/Modal";
import { Card, CardContent } from "$app/components/ui/Card";
import { PageHeader } from "$app/components/ui/PageHeader";
import { Pill } from "$app/components/ui/Pill";
import { Textarea } from "$app/components/ui/Textarea";

export type OrderRefund = {
  id: number;
  amount_formatted: string;
  reason?: string | null;
  created_at: string;
};

export type OrderSubscription = {
  id: string;
  is_active: boolean;
  status: string;
  cancelled_at?: string | null;
  failed_at?: string | null;
  frequency?: string | null;
};

export type OrderLicense = {
  id: string;
  serial: string;
  disabled: boolean;
};

export type OrderGift = {
  gifter_email?: string | null;
  giftee_email?: string | null;
};

export type OrderAffiliate = {
  affiliate_user_email?: string | null;
  affiliate_user_name?: string | null;
  amount_formatted: string;
};

export type OrderAccess = {
  has_download: boolean;
  download_url?: string | null;
  receipt_url?: string | null;
};

export type OrderDetailProps = {
  order: {
    id: string;
    external_id_numeric: string;
    customer_email: string;
    customer_name?: string | null;
    product_name: string;
    product_id?: string | null;
    variant_name?: string | null;
    seller: {
      id?: string | null;
      name: string;
      email?: string | null;
    };
    amount_formatted: string;
    price_cents: number;
    currency: string;
    platform_fee_formatted?: string | null;
    refunded_amount_formatted?: string | null;
    status: string;
    refund_status?: string | null;
    is_chargeback?: boolean;
    chargeback_date?: string | null;
    created_at: string;
    payment_processor?: string | null;
    transaction_id?: string | null;
    chapa_details?: {
      tx_ref: string;
      chapa_reference?: string | null;
      status: string;
      mode?: string | null;
      charge_formatted?: string | null;
      payment_method?: string | null;
      verified_at?: string | null;
    } | null;
    refunds: OrderRefund[];
    subscription?: OrderSubscription | null;
    license?: OrderLicense | null;
    gift?: OrderGift | null;
    affiliate?: OrderAffiliate | null;
    access: OrderAccess;
  };
};

const formatDateTime = (isoString?: string | null) => {
  if (!isoString) return "—";
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
};

export default function Show({ order }: OrderDetailProps) {
  const { t } = useTranslation();
  const [isSendingReceipt, setIsSendingReceipt] = React.useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = React.useState(false);
  const [refundReason, setRefundReason] = React.useState("");
  const [isRefunding, setIsRefunding] = React.useState(false);

  const [isCancelSubModalOpen, setIsCancelSubModalOpen] = React.useState(false);
  const [isCancellingSub, setIsCancellingSub] = React.useState(false);
  const [isReverifying, setIsReverifying] = React.useState(false);

  const handleReverify = () => {
    setIsReverifying(true);
    router.post(
      `/admin/orders/${order.id}/reverify`,
      {},
      {
        onFinish: () => setIsReverifying(false),
      },
    );
  };

  const handleResendReceipt = () => {
    setIsSendingReceipt(true);
    router.post(
      `/admin/orders/${order.id}/resend_receipt`,
      {},
      {
        onFinish: () => setIsSendingReceipt(false),
      },
    );
  };

  const handleRefundSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundReason.trim()) return;

    setIsRefunding(true);
    router.post(
      `/admin/orders/${order.id}/refund`,
      { reason: refundReason.trim() },
      {
        onFinish: () => {
          setIsRefunding(false);
          setIsRefundModalOpen(false);
          setRefundReason("");
        },
      },
    );
  };

  const handleCancelSubscription = () => {
    setIsCancellingSub(true);
    router.post(
      `/admin/orders/${order.id}/cancel_subscription`,
      {},
      {
        onFinish: () => {
          setIsCancellingSub(false);
          setIsCancelSubModalOpen(false);
        },
      },
    );
  };

  const isFullyRefunded = order.status === "refunded" || order.refund_status === "refunded";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/admin/orders"
          className="flex items-center gap-1.5 text-sm font-medium text-muted no-underline hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          <span>{t("admin.orders_page.back_to_orders", undefined, "Back to orders")}</span>
        </Link>
      </div>

      <PageHeader
        title={t(
          "admin.orders_page.order_title",
          { id: order.external_id_numeric },
          `Order #${order.external_id_numeric}`,
        )}
        showTitleOnMobile
        className="px-0 pt-0 pb-6"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              color="primary"
              disabled={isSendingReceipt}
              onClick={handleResendReceipt}
              className="flex items-center gap-2"
            >
              <Send className="size-4" />
              <span>
                {isSendingReceipt
                  ? t("admin.orders_page.sending_receipt", undefined, "Sending...")
                  : t("admin.orders_page.resend_receipt", undefined, "Resend receipt")}
              </span>
            </Button>

            {!isFullyRefunded ? (
              <Button outline onClick={() => setIsRefundModalOpen(true)} className="flex items-center gap-2">
                <RotateCcw className="size-4" />
                <span>{t("admin.orders_page.refund_order", undefined, "Refund order")}</span>
              </Button>
            ) : null}

            {order.subscription?.is_active ? (
              <Button color="danger" onClick={() => setIsCancelSubModalOpen(true)} className="flex items-center gap-2">
                <XCircle className="size-4" />
                <span>{t("admin.orders_page.cancel_subscription", undefined, "Cancel subscription")}</span>
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Pill
            color={order.status === "successful" ? "success" : order.status === "failed" ? "danger" : undefined}
            size="small"
          >
            {order.status === "successful"
              ? t("admin.orders_page.status_successful", undefined, "successful")
              : order.status === "failed"
                ? t("admin.status.failed", undefined, "Failed")
                : order.status}
          </Pill>
          {order.refund_status ? (
            <Pill color="warning" size="small">
              {order.refund_status === "refunded"
                ? t("admin.status.refunded", undefined, "Refunded")
                : order.refund_status === "partially_refunded"
                  ? t("admin.status.partially_refunded", undefined, "Partially Refunded")
                  : order.refund_status}
            </Pill>
          ) : null}
          {order.is_chargeback ? (
            <Pill color="danger" size="small">
              {t("admin.orders_page.disputed", undefined, "Disputed")}
            </Pill>
          ) : null}
          <span className="text-xs text-muted">
            {t(
              "admin.orders_page.placed_on",
              { date: formatDateTime(order.created_at) },
              `Placed on ${formatDateTime(order.created_at)}`,
            )}
          </span>
        </div>
      </PageHeader>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Columns: Order & Transaction details */}
        <div className="space-y-6 lg:col-span-2">
          {/* Summary Card */}
          <Card>
            <CardContent className="space-y-6 p-6">
              <h2 className="flex items-center gap-2 text-base font-bold">
                <Package className="size-5 text-muted" />
                <span>{t("admin.orders_page.order_details", undefined, "Order details")}</span>
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-muted">{t("admin.orders_page.product", undefined, "Product")}</div>
                  <div className="text-base font-semibold">{order.product_name}</div>
                  {order.variant_name ? (
                    <div className="text-xs text-muted">
                      {t("admin.orders_page.variant", { name: order.variant_name }, `Variant: ${order.variant_name}`)}
                    </div>
                  ) : null}
                </div>

                <div>
                  <div className="text-xs text-muted">
                    {t("admin.orders_page.amount_charged", undefined, "Amount charged")}
                  </div>
                  <div className="text-base font-semibold">{order.amount_formatted}</div>
                  <div className="text-xs text-muted">
                    {t("admin.orders_page.currency", { currency: order.currency }, `Currency: ${order.currency}`)}
                  </div>
                </div>

                {order.refunded_amount_formatted ? (
                  <div>
                    <div className="text-xs text-muted">
                      {t("admin.orders_page.total_refunded", undefined, "Total refunded")}
                    </div>
                    <div className="text-base font-semibold text-danger">{order.refunded_amount_formatted}</div>
                  </div>
                ) : null}

                <div>
                  <div className="text-xs text-muted">
                    {t("admin.orders_page.creator_seller", undefined, "Creator / Seller")}
                  </div>
                  <div className="font-medium">{order.seller.name}</div>
                  {order.seller.email ? <div className="text-xs text-muted">{order.seller.email}</div> : null}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment & Processing Card */}
          <Card>
            <CardContent className="space-y-6 p-6">
              <h2 className="flex items-center gap-2 text-base font-bold">
                <CreditCard className="size-5 text-muted" />
                <span>{t("admin.orders_page.payment_and_processing", undefined, "Payment & processing")}</span>
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-muted">{t("admin.orders_page.processor", undefined, "Processor")}</div>
                  <div className="font-mono text-sm uppercase">
                    {order.payment_processor || t("admin.orders_page.standard_processor", undefined, "Standard")}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted">
                    {t("admin.orders_page.payment_reference", undefined, "Payment reference / Transaction ID")}
                  </div>
                  <div className="font-mono text-sm break-all">
                    {order.transaction_id || t("admin.orders_page.none_recorded", undefined, "None recorded")}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted">
                    {t("admin.orders_page.platform_fee", undefined, "Platform fee (15%)")}
                  </div>
                  <div className="text-sm font-medium">{order.platform_fee_formatted || "—"}</div>
                </div>

                {order.chapa_details ? (
                  <div>
                    <div className="text-xs text-muted">
                      {t("admin.orders_page.gateway_fee", undefined, "Chapa gateway fee")}
                    </div>
                    <div className="text-sm font-medium">{order.chapa_details.charge_formatted || "—"}</div>
                  </div>
                ) : null}

                {order.chapa_details ? (
                  <>
                    <div>
                      <div className="text-xs text-muted">{t("admin.orders_page.chapa_tx_ref")}</div>
                      <div className="font-mono text-sm break-all">{order.chapa_details.tx_ref}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted">{t("admin.orders_page.chapa_reference")}</div>
                      <div className="font-mono text-sm break-all">{order.chapa_details.chapa_reference || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted">{t("admin.orders_page.gateway_status")}</div>
                      <div className="text-sm font-medium capitalize">{order.chapa_details.status}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted">{t("admin.orders_page.gateway_mode")}</div>
                      <div className="font-mono text-sm uppercase">{order.chapa_details.mode || "—"}</div>
                    </div>
                    <div className="flex items-end">
                      <Button outline disabled={isReverifying} onClick={handleReverify} className="text-xs">
                        {isReverifying
                          ? t("admin.orders_page.reverifying")
                          : t("admin.orders_page.reverify_gateway_status")}
                      </Button>
                    </div>
                  </>
                ) : null}

                {order.is_chargeback ? (
                  <div>
                    <div className="text-xs text-muted">
                      {t("admin.orders_page.chargeback_initiated", undefined, "Chargeback initiated")}
                    </div>
                    <div className="text-sm font-medium text-danger">{formatDateTime(order.chargeback_date)}</div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* Refunds History */}
          {order.refunds.length > 0 ? (
            <Card>
              <CardContent className="space-y-4 p-6">
                <h2 className="flex items-center gap-2 text-base font-bold">
                  <RotateCcw className="size-5 text-muted" />
                  <span>
                    {t(
                      "admin.orders_page.refund_history",
                      { count: order.refunds.length },
                      `Refund history (${order.refunds.length})`,
                    )}
                  </span>
                </h2>

                <div className="space-y-3">
                  {order.refunds.map((refund) => (
                    <div
                      key={refund.id}
                      className="flex flex-col justify-between gap-2 rounded border border-border bg-active-bg p-4 sm:flex-row sm:items-center"
                    >
                      <div>
                        <div className="font-semibold text-danger">{refund.amount_formatted}</div>
                        <div className="text-xs text-muted">
                          {t(
                            "admin.orders_page.reason",
                            {
                              reason:
                                refund.reason ||
                                t("admin.orders_page.no_reason_provided", undefined, "No reason provided"),
                            },
                            `Reason: ${refund.reason || "No reason provided"}`,
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted">{formatDateTime(refund.created_at)}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Subscription Section (if applicable) */}
          {order.subscription ? (
            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold">
                    {t("admin.orders_page.subscription_details", undefined, "Subscription details")}
                  </h2>
                  <Pill
                    color={
                      order.subscription.status === "active"
                        ? "success"
                        : order.subscription.status === "failing"
                          ? "danger"
                          : undefined
                    }
                    size="small"
                  >
                    {order.subscription.status === "active"
                      ? t("admin.status.active", undefined, "Active")
                      : order.subscription.status}
                  </Pill>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted">{t("admin.orders_page.frequency", undefined, "Frequency")}</div>
                    <div className="text-sm font-medium capitalize">{order.subscription.frequency || "Recurring"}</div>
                  </div>

                  {order.subscription.cancelled_at ? (
                    <div>
                      <div className="text-xs text-muted">
                        {t("admin.orders_page.cancelled_at", undefined, "Cancelled at")}
                      </div>
                      <div className="text-sm font-medium text-danger">
                        {formatDateTime(order.subscription.cancelled_at)}
                      </div>
                    </div>
                  ) : null}

                  {order.subscription.failed_at ? (
                    <div>
                      <div className="text-xs text-muted">
                        {t("admin.orders_page.payment_failed_at", undefined, "Payment failed at")}
                      </div>
                      <div className="text-sm font-medium text-danger">
                        {formatDateTime(order.subscription.failed_at)}
                      </div>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Right 1 Column: Customer & Additional Context */}
        <div className="space-y-6">
          {/* Customer Card */}
          <Card>
            <CardContent className="space-y-4 p-6">
              <h2 className="flex items-center gap-2 text-base font-bold">
                <User className="size-5 text-muted" />
                <span>{t("admin.orders_page.customer", undefined, "Customer")}</span>
              </h2>

              <div>
                <div className="text-xs text-muted">{t("admin.orders_page.email", undefined, "Email")}</div>
                <div className="font-semibold break-all">{order.customer_email}</div>
              </div>

              {order.customer_name ? (
                <div>
                  <div className="text-xs text-muted">{t("admin.orders_page.name", undefined, "Name")}</div>
                  <div className="text-sm">{order.customer_name}</div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Delivery & Access Card */}
          <Card>
            <CardContent className="space-y-4 p-6">
              <h2 className="flex items-center gap-2 text-base font-bold">
                <Receipt className="size-5 text-muted" />
                <span>{t("admin.orders_page.receipt_and_delivery", undefined, "Receipt & delivery")}</span>
              </h2>

              {order.access.receipt_url ? (
                <div>
                  <a
                    href={order.access.receipt_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-sm font-semibold text-accent underline-offset-2 hover:underline"
                  >
                    <span>{t("admin.orders_page.view_customer_receipt", undefined, "View customer receipt")}</span>
                  </a>
                </div>
              ) : null}

              {order.access.has_download && order.access.download_url ? (
                <div>
                  <a
                    href={order.access.download_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-sm font-semibold text-accent underline-offset-2 hover:underline"
                  >
                    <FileDetail className="size-4" />
                    <span>{t("admin.orders_page.access_download_page", undefined, "Access download page")}</span>
                  </a>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* License Key Card (if applicable) */}
          {order.license ? (
            <Card>
              <CardContent className="space-y-3 p-6">
                <h2 className="flex items-center gap-2 text-base font-bold">
                  <Key className="size-5 text-muted" />
                  <span>{t("admin.orders_page.license_key", undefined, "License key")}</span>
                </h2>
                <div>
                  <div className="text-xs text-muted">{t("admin.orders_page.key_serial", undefined, "Key serial")}</div>
                  <div className="mt-1 rounded bg-active-bg p-2 font-mono text-xs break-all select-all">
                    {order.license.serial}
                  </div>
                </div>
                {order.license.disabled ? (
                  <Pill color="danger" size="small">
                    {t("admin.status.disabled", undefined, "Disabled")}
                  </Pill>
                ) : (
                  <Pill color="success" size="small">
                    {t("admin.status.active", undefined, "Active")}
                  </Pill>
                )}
              </CardContent>
            </Card>
          ) : null}

          {/* Gift Card (if applicable) */}
          {order.gift ? (
            <Card>
              <CardContent className="space-y-3 p-6">
                <h2 className="text-base font-bold">
                  {t("admin.orders_page.gift_purchase", undefined, "Gift purchase")}
                </h2>
                <div>
                  <div className="text-xs text-muted">{t("admin.orders_page.gifter", undefined, "Gifter")}</div>
                  <div className="text-sm font-medium">{order.gift.gifter_email || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">
                    {t("admin.orders_page.giftee", undefined, "Recipient (Giftee)")}
                  </div>
                  <div className="text-sm font-medium">{order.gift.giftee_email || "—"}</div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Affiliate Card (if applicable) */}
          {order.affiliate ? (
            <Card>
              <CardContent className="space-y-3 p-6">
                <h2 className="text-base font-bold">
                  {t("admin.orders_page.affiliate_attribution", undefined, "Affiliate attribution")}
                </h2>
                <div>
                  <div className="text-xs text-muted">
                    {t("admin.orders_page.affiliate_partner", undefined, "Affiliate partner")}
                  </div>
                  <div className="text-sm font-medium">
                    {order.affiliate.affiliate_user_name
                      ? `${order.affiliate.affiliate_user_name} (${order.affiliate.affiliate_user_email})`
                      : order.affiliate.affiliate_user_email}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">
                    {t("admin.orders_page.affiliate_commission", undefined, "Affiliate commission")}
                  </div>
                  <div className="text-sm font-medium">{order.affiliate.amount_formatted}</div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {/* Modal: Refund Order */}
      <Modal
        open={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
        title={t("admin.orders_page.refund_order", undefined, "Refund order")}
        footer={
          <div className="flex w-full justify-end gap-3">
            <Button type="button" outline disabled={isRefunding} onClick={() => setIsRefundModalOpen(false)}>
              {t("admin.orders_page.cancel", undefined, "Cancel")}
            </Button>
            <Button
              type="button"
              color="danger"
              disabled={isRefunding || !refundReason.trim()}
              onClick={handleRefundSubmit}
            >
              {isRefunding
                ? t("admin.orders_page.refunding", undefined, "Refunding...")
                : t("admin.orders_page.confirm_full_refund", undefined, "Confirm full refund")}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleRefundSubmit} className="space-y-4">
          <div className="space-y-2 rounded border border-border bg-active-bg p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">{t("admin.orders_page.customer", undefined, "Customer:")}</span>
              <span className="font-medium">{order.customer_email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">{t("admin.orders_page.product", undefined, "Product:")}</span>
              <span className="font-medium">{order.product_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">
                {t("admin.orders_page.refund_amount_label", undefined, "Refund amount:")}
              </span>
              <span className="font-bold">
                {t(
                  "admin.orders_page.full_refund_suffix",
                  { amount: order.amount_formatted },
                  `${order.amount_formatted} (Full)`,
                )}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="refund-reason" className="block text-sm font-medium">
              {t("admin.orders_page.reason_for_refund", undefined, "Reason for refund")}{" "}
              <span className="text-danger">*</span>
            </label>
            <Textarea
              id="refund-reason"
              placeholder={t(
                "admin.orders_page.refund_reason_placeholder",
                undefined,
                "State the reason for this refund...",
              )}
              rows={3}
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              required
            />
            <p className="text-xs text-muted">
              {t("admin.orders_page.sent_to_creator_by_email", undefined, "Sent to the creator by email")}
            </p>
          </div>
        </form>
      </Modal>

      {/* Modal: Cancel Subscription */}
      <Modal
        open={isCancelSubModalOpen}
        onClose={() => setIsCancelSubModalOpen(false)}
        title={t("admin.orders_page.cancel_subscription", undefined, "Cancel subscription")}
        footer={
          <div className="flex w-full justify-end gap-3">
            <Button type="button" outline disabled={isCancellingSub} onClick={() => setIsCancelSubModalOpen(false)}>
              {t("admin.orders_page.keep_active", undefined, "Keep active")}
            </Button>
            <Button type="button" color="danger" disabled={isCancellingSub} onClick={handleCancelSubscription}>
              {isCancellingSub
                ? t("admin.orders_page.cancelling", undefined, "Cancelling...")
                : t("admin.orders_page.confirm_cancellation", undefined, "Confirm cancellation")}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <p>
            {t(
              "admin.orders_page.cancel_subscription_prompt",
              { email: order.customer_email },
              `Are you sure you want to cancel the recurring subscription for ${order.customer_email}?`,
            )}
          </p>
          <p className="text-muted">
            {t(
              "admin.orders_page.cancel_subscription_help",
              undefined,
              "The customer will not be billed again. Access to the product will remain active until the end of the current billing cycle.",
            )}
          </p>
        </div>
      </Modal>
    </div>
  );
}

Show.layout = (page: React.ReactNode) => <AdminLayout>{page}</AdminLayout>;
