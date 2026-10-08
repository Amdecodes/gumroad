import { ArrowLeft } from "@boxicons/react";
import { Link, router } from "@inertiajs/react";
import * as React from "react";

import { AdminLayout } from "$app/components/Admin/AdminLayout";
import { Button } from "$app/components/Button";
import { Card, CardContent, CardHeader, CardTitle } from "$app/components/ui/Card";
import { PageHeader } from "$app/components/ui/PageHeader";
import { Pill } from "$app/components/ui/Pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$app/components/ui/Table";

export type SubscriptionDetail = {
  id: string;
  subscriber: {
    id?: string | null;
    name?: string | null;
    email: string;
  };
  seller: {
    id?: string | null;
    name: string;
    email: string;
  };
  product: {
    id?: string | null;
    name: string;
    unique_permalink?: string | null;
  };
  amount_formatted: string;
  price_cents: number;
  frequency: string;
  status: string;
  is_installment_plan: boolean;
  charges_completed: number;
  created_at: string;
  updated_at: string;
  cancelled_at?: string | null;
  failed_at?: string | null;
  deactivated_at?: string | null;
  next_charge_date?: string | null;
  grace_period_deadline?: string | null;
  charges: Array<{
    id: string;
    amount_formatted: string;
    status: string;
    payment_processor: string;
    transaction_id?: string | null;
    created_at: string;
  }>;
};

export type SubscriptionsShowProps = {
  subscription: SubscriptionDetail;
};

const formatDate = (isoString?: string | null) => {
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

export default function SubscriptionsShow({ subscription }: SubscriptionsShowProps) {
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const canCancel = subscription.status === "active" || subscription.status === "failing";

  const handleCancel = () => {
    setIsCancelling(true);
    router.post(
      `/admin/subscriptions/${subscription.id}/cancel`,
      {},
      {
        onFinish: () => {
          setIsCancelling(false);
          setShowConfirm(false);
        },
      },
    );
  };

  return (
    <AdminLayout currentPath="/admin/subscriptions">
      <div className="space-y-6">
        <div>
          <Link
            href="/admin/subscriptions"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to Subscriptions
          </Link>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <PageHeader
            title={`Subscription ${subscription.id}`}
            description={`Managed recurring subscription for ${subscription.product.name}`}
          />
          <div className="flex items-center gap-3">
            {subscription.status === "active" && <Pill color="success">Active</Pill>}
            {subscription.status === "failing" && <Pill color="warning">Failing / Grace Period</Pill>}
            {subscription.status === "cancelled" && <Pill color="danger">Cancelled</Pill>}
            {subscription.status === "deactivated" && <Pill>Expired / Deactivated</Pill>}

            {canCancel ? (
              <Button
                variant="danger"
                size="small"
                onClick={() => setShowConfirm(true)}
                disabled={isCancelling}
              >
                Cancel Subscription
              </Button>
            ) : null}
          </div>
        </div>

        {showConfirm ? (
          <Card className="border-danger/30 bg-danger/5">
            <CardContent className="p-4 sm:p-6">
              <h3 className="text-danger text-base font-semibold">Confirm Cancellation</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Are you sure you want to cancel subscription <span className="font-mono">{subscription.id}</span>? The customer will no longer be prompted for renewals.
              </p>
              <div className="mt-4 flex gap-2">
                <Button variant="danger" size="small" onClick={handleCancel} disabled={isCancelling}>
                  {isCancelling ? "Cancelling..." : "Yes, Cancel Subscription"}
                </Button>
                <Button variant="secondary" size="small" onClick={() => setShowConfirm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold tracking-wider uppercase text-muted-foreground">Subscriber</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-foreground font-semibold">{subscription.subscriber.email}</div>
              {subscription.subscriber.name ? (
                <div className="text-muted-foreground text-sm">{subscription.subscriber.name}</div>
              ) : null}
              {subscription.subscriber.id ? (
                <div className="text-xs text-muted-foreground">User ID: {subscription.subscriber.id}</div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold tracking-wider uppercase text-muted-foreground">Creator</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-foreground font-semibold">{subscription.seller.name}</div>
              <div className="text-muted-foreground text-sm">{subscription.seller.email}</div>
              {subscription.seller.id ? (
                <Link
                  href={`/admin/creators/${subscription.seller.id}`}
                  className="text-accent text-xs font-medium hover:underline inline-block mt-1"
                >
                  View Creator Profile →
                </Link>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold tracking-wider uppercase text-muted-foreground">Plan & Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-foreground text-lg font-bold">{subscription.amount_formatted}</div>
              <div className="text-muted-foreground text-sm capitalize">Recurrence: {subscription.frequency}</div>
              <div className="text-muted-foreground text-xs">
                Completed Payments: {subscription.charges_completed}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Period & State Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <span className="text-muted-foreground text-xs">Created At</span>
                <p className="text-foreground mt-0.5 text-sm font-medium">{formatDate(subscription.created_at)}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Next Renewal Date</span>
                <p className="text-foreground mt-0.5 text-sm font-medium">{formatDate(subscription.next_charge_date)}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Grace Period Deadline</span>
                <p className="text-foreground mt-0.5 text-sm font-medium">{formatDate(subscription.grace_period_deadline)}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Cancelled At</span>
                <p className="text-foreground mt-0.5 text-sm font-medium">{formatDate(subscription.cancelled_at)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment & Renewal History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {subscription.charges.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                No renewal payment records found for this subscription.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Charge ID</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Processor</TableHead>
                    <TableHead>Reference / TxID</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscription.charges.map((charge) => (
                    <TableRow key={charge.id}>
                      <TableCell className="font-mono text-xs">
                        <Link href={`/admin/orders/${charge.id}`} className="text-accent hover:underline">
                          {charge.id}
                        </Link>
                      </TableCell>
                      <TableCell className="font-semibold text-sm">{charge.amount_formatted}</TableCell>
                      <TableCell>
                        <Pill
                          color={charge.status === "successful" ? "success" : "danger"}
                          size="small"
                        >
                          {charge.status}
                        </Pill>
                      </TableCell>
                      <TableCell className="text-xs uppercase">{charge.payment_processor}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {charge.transaction_id || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(charge.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
