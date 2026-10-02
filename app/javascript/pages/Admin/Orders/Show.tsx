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
    refunded_amount_formatted?: string | null;
    status: string;
    refund_status?: string | null;
    is_chargeback?: boolean;
    chargeback_date?: string | null;
    created_at: string;
    payment_processor?: string | null;
    transaction_id?: string | null;
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
  const [isSendingReceipt, setIsSendingReceipt] = React.useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = React.useState(false);
  const [refundReason, setRefundReason] = React.useState("");
  const [isRefunding, setIsRefunding] = React.useState(false);

  const [isCancelSubModalOpen, setIsCancelSubModalOpen] = React.useState(false);
  const [isCancellingSub, setIsCancellingSub] = React.useState(false);

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
          <span>Back to orders</span>
        </Link>
      </div>

      <PageHeader
        title={`Order #${order.external_id_numeric}`}
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
              <span>{isSendingReceipt ? "Sending..." : "Resend receipt"}</span>
            </Button>

            {!isFullyRefunded ? (
              <Button outline onClick={() => setIsRefundModalOpen(true)} className="flex items-center gap-2">
                <RotateCcw className="size-4" />
                <span>Refund order</span>
              </Button>
            ) : null}

            {order.subscription?.is_active ? (
              <Button color="danger" onClick={() => setIsCancelSubModalOpen(true)} className="flex items-center gap-2">
                <XCircle className="size-4" />
                <span>Cancel subscription</span>
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
            {order.status}
          </Pill>
          {order.refund_status ? (
            <Pill color="warning" size="small">
              {order.refund_status}
            </Pill>
          ) : null}
          {order.is_chargeback ? (
            <Pill color="danger" size="small">
              Disputed
            </Pill>
          ) : null}
          <span className="text-xs text-muted">Placed on {formatDateTime(order.created_at)}</span>
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
                <span>Order details</span>
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-muted">Product</div>
                  <div className="text-base font-semibold">{order.product_name}</div>
                  {order.variant_name ? <div className="text-xs text-muted">Variant: {order.variant_name}</div> : null}
                </div>

                <div>
                  <div className="text-xs text-muted">Amount charged</div>
                  <div className="text-base font-semibold">{order.amount_formatted}</div>
                  <div className="text-xs text-muted">Currency: {order.currency}</div>
                </div>

                {order.refunded_amount_formatted ? (
                  <div>
                    <div className="text-xs text-muted">Total refunded</div>
                    <div className="text-base font-semibold text-danger">{order.refunded_amount_formatted}</div>
                  </div>
                ) : null}

                <div>
                  <div className="text-xs text-muted">Creator / Seller</div>
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
                <span>Payment & processing</span>
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-muted">Processor</div>
                  <div className="font-mono text-sm uppercase">{order.payment_processor || "Standard"}</div>
                </div>

                <div>
                  <div className="text-xs text-muted">Payment reference / Transaction ID</div>
                  <div className="font-mono text-sm break-all">{order.transaction_id || "None recorded"}</div>
                </div>

                {order.is_chargeback ? (
                  <div>
                    <div className="text-xs text-muted">Chargeback initiated</div>
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
                  <span>Refund history ({order.refunds.length})</span>
                </h2>

                <div className="space-y-3">
                  {order.refunds.map((refund) => (
                    <div
                      key={refund.id}
                      className="flex flex-col justify-between gap-2 rounded border border-border bg-active-bg p-4 sm:flex-row sm:items-center"
                    >
                      <div>
                        <div className="font-semibold text-danger">{refund.amount_formatted}</div>
                        <div className="text-xs text-muted">Reason: {refund.reason || "No reason provided"}</div>
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
                  <h2 className="text-base font-bold">Subscription details</h2>
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
                    {order.subscription.status}
                  </Pill>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted">Frequency</div>
                    <div className="text-sm font-medium capitalize">{order.subscription.frequency || "Recurring"}</div>
                  </div>

                  {order.subscription.cancelled_at ? (
                    <div>
                      <div className="text-xs text-muted">Cancelled at</div>
                      <div className="text-sm font-medium text-danger">
                        {formatDateTime(order.subscription.cancelled_at)}
                      </div>
                    </div>
                  ) : null}

                  {order.subscription.failed_at ? (
                    <div>
                      <div className="text-xs text-muted">Payment failed at</div>
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
                <span>Customer</span>
              </h2>

              <div>
                <div className="text-xs text-muted">Email</div>
                <div className="font-semibold break-all">{order.customer_email}</div>
              </div>

              {order.customer_name ? (
                <div>
                  <div className="text-xs text-muted">Name</div>
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
                <span>Receipt & delivery</span>
              </h2>

              {order.access.receipt_url ? (
                <div>
                  <a
                    href={order.access.receipt_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-sm font-semibold text-accent underline-offset-2 hover:underline"
                  >
                    <span>View customer receipt</span>
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
                    <span>Access download page</span>
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
                  <span>License key</span>
                </h2>
                <div>
                  <div className="text-xs text-muted">Key serial</div>
                  <div className="mt-1 rounded bg-active-bg p-2 font-mono text-xs break-all select-all">
                    {order.license.serial}
                  </div>
                </div>
                {order.license.disabled ? (
                  <Pill color="danger" size="small">
                    Disabled
                  </Pill>
                ) : (
                  <Pill color="success" size="small">
                    Active
                  </Pill>
                )}
              </CardContent>
            </Card>
          ) : null}

          {/* Gift Card (if applicable) */}
          {order.gift ? (
            <Card>
              <CardContent className="space-y-3 p-6">
                <h2 className="text-base font-bold">Gift purchase</h2>
                <div>
                  <div className="text-xs text-muted">Gifter</div>
                  <div className="text-sm font-medium">{order.gift.gifter_email || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Recipient (Giftee)</div>
                  <div className="text-sm font-medium">{order.gift.giftee_email || "—"}</div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Affiliate Card (if applicable) */}
          {order.affiliate ? (
            <Card>
              <CardContent className="space-y-3 p-6">
                <h2 className="text-base font-bold">Affiliate attribution</h2>
                <div>
                  <div className="text-xs text-muted">Affiliate partner</div>
                  <div className="text-sm font-medium">
                    {order.affiliate.affiliate_user_name
                      ? `${order.affiliate.affiliate_user_name} (${order.affiliate.affiliate_user_email})`
                      : order.affiliate.affiliate_user_email}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">Affiliate commission</div>
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
        title="Refund order"
        footer={
          <div className="flex w-full justify-end gap-3">
            <Button type="button" outline disabled={isRefunding} onClick={() => setIsRefundModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              color="danger"
              disabled={isRefunding || !refundReason.trim()}
              onClick={handleRefundSubmit}
            >
              {isRefunding ? "Refunding..." : "Confirm full refund"}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleRefundSubmit} className="space-y-4">
          <div className="space-y-2 rounded border border-border bg-active-bg p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Customer:</span>
              <span className="font-medium">{order.customer_email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Product:</span>
              <span className="font-medium">{order.product_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Refund amount:</span>
              <span className="font-bold">{order.amount_formatted} (Full)</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="refund-reason" className="block text-sm font-medium">
              Reason for refund <span className="text-danger">*</span>
            </label>
            <Textarea
              id="refund-reason"
              placeholder="State the reason for this refund..."
              rows={3}
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              required
            />
            <p className="text-xs text-muted">Sent to the creator by email</p>
          </div>
        </form>
      </Modal>

      {/* Modal: Cancel Subscription */}
      <Modal
        open={isCancelSubModalOpen}
        onClose={() => setIsCancelSubModalOpen(false)}
        title="Cancel subscription"
        footer={
          <div className="flex w-full justify-end gap-3">
            <Button type="button" outline disabled={isCancellingSub} onClick={() => setIsCancelSubModalOpen(false)}>
              Keep active
            </Button>
            <Button type="button" color="danger" disabled={isCancellingSub} onClick={handleCancelSubscription}>
              {isCancellingSub ? "Cancelling..." : "Confirm cancellation"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <p>
            Are you sure you want to cancel the recurring subscription for <strong>{order.customer_email}</strong>?
          </p>
          <p className="text-muted">
            The customer will not be billed again. Access to the product will remain active until the end of the current
            billing cycle.
          </p>
        </div>
      </Modal>
    </div>
  );
}

Show.layout = (page: React.ReactNode) => <AdminLayout>{page}</AdminLayout>;
