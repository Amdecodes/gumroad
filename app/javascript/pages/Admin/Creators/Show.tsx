import { ArrowLeft, CheckCircle, DollarCircle, Package, Store, User, UserCheck } from "@boxicons/react";
import { Link, router } from "@inertiajs/react";
import * as Dialog from "@radix-ui/react-dialog";
import * as React from "react";

import { AdminLayout } from "$app/components/Admin/AdminLayout";
import { Button } from "$app/components/Button";
import { Modal } from "$app/components/Modal";
import { Card, CardContent } from "$app/components/ui/Card";
import { Pill } from "$app/components/ui/Pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$app/components/ui/Table";
import { Textarea } from "$app/components/ui/Textarea";

export type CreatorProfile = {
  external_id: string;
  username: string;
  display_name: string;
  email: string;
  avatar_url: string;
  bio?: string | null;
  joined_at: string;
  status: string;
  verified_status: boolean;
};

export type CreatorMetrics = {
  lifetime_revenue_cents: number;
  formatted_lifetime_revenue: string;
  sales_count: number;
  active_products_count: number;
  customer_count: number;
};

export type CreatorProduct = {
  id: string;
  title: string;
  price_formatted: string;
  sales_count: number;
  status: string;
  published_date: string;
};

export type CreatorPaymentInfo = {
  payout_setup: boolean;
  payouts_paused: boolean;
  payouts_paused_reason?: string | null;
  payment_address?: string | null;
  paypal_email?: string | null;
  verified: boolean;
};

export type CreatorAuditLog = {
  id: string;
  action: string;
  actor_name: string;
  created_at: string;
  response_status?: number | null;
};

export type CreatorShowProps = {
  profile: CreatorProfile;
  metrics: CreatorMetrics;
  products: CreatorProduct[];
  payment_info: CreatorPaymentInfo;
  impersonate_url: string;
  audit_history: CreatorAuditLog[];
};

const formatDate = (isoString?: string | null) => {
  if (!isoString) return "—";
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
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

const renderCreatorStatusPill = (status: string) => {
  switch (status) {
    case "active":
      return (
        <Pill color="success" size="small">
          Active
        </Pill>
      );
    case "suspended":
      return (
        <Pill color="danger" size="small">
          Suspended
        </Pill>
      );
    case "deleted":
      return (
        <Pill color="warning" size="small">
          Deleted
        </Pill>
      );
    default:
      return <Pill size="small">{status}</Pill>;
  }
};

export default function Show({
  profile,
  metrics,
  products,
  payment_info,
  impersonate_url,
  audit_history,
}: CreatorShowProps) {
  const [suspendModalOpen, setSuspendModalOpen] = React.useState(false);
  const [unsuspendModalOpen, setUnsuspendModalOpen] = React.useState(false);

  const [suspendReason, setSuspendReason] = React.useState("");
  const [suspendReasonType, setSuspendReasonType] = React.useState("tos_violation");
  const [suspendSubmitting, setSuspendSubmitting] = React.useState(false);
  const [suspendError, setSuspendError] = React.useState<string | null>(null);

  const [unsuspendReason, setUnsuspendReason] = React.useState("");
  const [unsuspendSubmitting, setUnsuspendSubmitting] = React.useState(false);
  const [unsuspendError, setUnsuspendError] = React.useState<string | null>(null);

  const isSuspended = profile.status === "suspended";

  const handleSuspendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!suspendReason.trim()) {
      setSuspendError("Reason for suspension is required");
      return;
    }

    setSuspendSubmitting(true);
    setSuspendError(null);

    router.post(
      `/admin/creators/${profile.external_id}/suspend`,
      {
        reason: suspendReason.trim(),
        reason_type: suspendReasonType,
      },
      {
        preserveScroll: true,
        onSuccess: () => {
          setSuspendModalOpen(false);
          setSuspendReason("");
        },
        onError: (errors) => {
          setSuspendError(errors.message || "Failed to suspend creator");
        },
        onFinish: () => {
          setSuspendSubmitting(false);
        },
      },
    );
  };

  const handleUnsuspendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unsuspendReason.trim()) {
      setUnsuspendError("Reason for lifting suspension is required");
      return;
    }

    setUnsuspendSubmitting(true);
    setUnsuspendError(null);

    router.post(
      `/admin/creators/${profile.external_id}/unsuspend`,
      {
        reason: unsuspendReason.trim(),
      },
      {
        preserveScroll: true,
        onSuccess: () => {
          setUnsuspendModalOpen(false);
          setUnsuspendReason("");
        },
        onError: (errors) => {
          setUnsuspendError(errors.message || "Failed to lift suspension");
        },
        onFinish: () => {
          setUnsuspendSubmitting(false);
        },
      },
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Back navigation & Top Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/creators"
              className="text-muted-foreground inline-flex items-center gap-1.5 text-sm font-medium no-underline hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              <span>Back to creators</span>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href={impersonate_url}
              className="inline-flex items-center gap-1.5 rounded border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground no-underline transition-colors hover:bg-muted"
            >
              <UserCheck className="text-muted-foreground size-4" />
              <span>Impersonate</span>
            </a>

            {isSuspended ? (
              <Button
                type="button"
                size="sm"
                color="primary"
                onClick={() => {
                  setUnsuspendError(null);
                  setUnsuspendReason("");
                  setUnsuspendModalOpen(true);
                }}
              >
                Unsuspend Creator
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                color="danger"
                onClick={() => {
                  setSuspendError(null);
                  setSuspendReason("");
                  setSuspendModalOpen(true);
                }}
              >
                Suspend Creator
              </Button>
            )}
          </div>
        </div>

        {/* Creator Hero Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name}
                  className="size-16 rounded-full bg-muted object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">{profile.display_name}</h1>
                    {renderCreatorStatusPill(profile.status)}
                    {profile.verified_status ? (
                      <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                        <CheckCircle className="size-3.5" />
                        Verified
                      </span>
                    ) : null}
                  </div>
                  <div className="text-muted-foreground flex flex-wrap items-center gap-3 pt-1 text-sm">
                    <span>{profile.username ? `@${profile.username}` : "No username"}</span>
                    <span>•</span>
                    <span>{profile.email}</span>
                    <span>•</span>
                    <span>Joined {formatDate(profile.joined_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium uppercase">Lifetime Volume</span>
                <DollarCircle className="text-muted-foreground size-5 opacity-70" />
              </div>
              <p className="mt-2 text-2xl font-bold text-foreground">{metrics.formatted_lifetime_revenue}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium uppercase">Total Sales</span>
                <Package className="text-muted-foreground size-5 opacity-70" />
              </div>
              <p className="mt-2 text-2xl font-bold text-foreground">{metrics.sales_count}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium uppercase">Active Products</span>
                <Store className="text-muted-foreground size-5 opacity-70" />
              </div>
              <p className="mt-2 text-2xl font-bold text-foreground">{metrics.active_products_count}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium uppercase">Customers</span>
                <User className="text-muted-foreground size-5 opacity-70" />
              </div>
              <p className="mt-2 text-2xl font-bold text-foreground">{metrics.customer_count}</p>
            </CardContent>
          </Card>
        </div>

        {/* Two-Column Grid: Profile & Payment Info */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Profile & Account Details */}
          <Card>
            <div className="border-b border-border p-4 text-base font-semibold">Profile & Account Details</div>
            <CardContent className="divide-y divide-border p-0 text-sm">
              <div className="flex items-center justify-between p-4">
                <span className="text-muted-foreground">External ID</span>
                <span className="font-mono text-xs text-foreground">{profile.external_id}</span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-muted-foreground">Username</span>
                <span className="font-medium text-foreground">{profile.username ? `@${profile.username}` : "—"}</span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium text-foreground">{profile.email}</span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-muted-foreground">Bio</span>
                <span className="text-muted-foreground max-w-xs truncate text-right">
                  {profile.bio || "None provided"}
                </span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-muted-foreground">Account Status</span>
                <div>{renderCreatorStatusPill(profile.status)}</div>
              </div>
            </CardContent>
          </Card>

          {/* Compliance & Payout Information */}
          <Card>
            <div className="border-b border-border p-4 text-base font-semibold">Compliance & Payout Status</div>
            <CardContent className="divide-y divide-border p-0 text-sm">
              <div className="flex items-center justify-between p-4">
                <span className="text-muted-foreground">Payout Setup</span>
                <span className="font-medium">
                  {payment_info.payout_setup ? (
                    <span className="text-green-600 dark:text-green-400">Configured</span>
                  ) : (
                    <span className="text-muted-foreground">Not Configured</span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-muted-foreground">Payouts Standing</span>
                <span>
                  {payment_info.payouts_paused ? (
                    <Pill color="danger" size="small">
                      Paused: {payment_info.payouts_paused_reason || "Administrative hold"}
                    </Pill>
                  ) : (
                    <Pill color="success" size="small">
                      Active
                    </Pill>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-muted-foreground">Payout Email (PayPal)</span>
                <span className="font-medium text-foreground">{payment_info.paypal_email || "—"}</span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-muted-foreground">Payment Address</span>
                <span className="font-medium text-foreground">{payment_info.payment_address || "—"}</span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-muted-foreground">Compliance Verified</span>
                <span>
                  {payment_info.verified ? (
                    <span className="font-medium text-green-600 dark:text-green-400">Yes</span>
                  ) : (
                    <span className="text-muted-foreground">Unverified</span>
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Products Table */}
        <Card>
          <div className="border-b border-border p-4 text-base font-semibold">Recent Products</div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Title</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Sales</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Published Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground h-32 text-center">
                      No products found for this creator.
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium text-foreground">{product.title}</TableCell>
                      <TableCell>{product.price_formatted}</TableCell>
                      <TableCell>{product.sales_count}</TableCell>
                      <TableCell>
                        <Pill color={product.status === "published" ? "success" : undefined} size="small">
                          {product.status}
                        </Pill>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDate(product.published_date)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Audit History */}
        {audit_history && audit_history.length > 0 ? (
          <Card>
            <div className="border-b border-border p-4 text-base font-semibold">Recent Administrative Actions</div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Admin Actor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit_history.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">{log.action}</TableCell>
                      <TableCell>{log.actor_name}</TableCell>
                      <TableCell>
                        <span className="text-xs font-medium">
                          {log.response_status ? `HTTP ${log.response_status}` : "Completed"}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{formatDateTime(log.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        ) : null}

        {/* Suspend Modal */}
        <Modal
          open={suspendModalOpen}
          onClose={() => {
            if (!suspendSubmitting) {
              setSuspendModalOpen(false);
            }
          }}
          title="Suspend Creator Account"
          footer={
            <div className="flex items-center gap-3">
              <Button type="button" outline disabled={suspendSubmitting} onClick={() => setSuspendModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                color="danger"
                disabled={suspendSubmitting || !suspendReason.trim()}
                onClick={handleSuspendSubmit}
              >
                {suspendSubmitting ? "Suspending..." : "Confirm Suspension"}
              </Button>
            </div>
          }
        >
          <Dialog.Description className="sr-only">
            Modal to suspend creator account with mandatory reason.
          </Dialog.Description>
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Suspending this creator will disable their store listings, prevent future purchases, and pause payout
              distributions.
            </p>

            {suspendError ? (
              <div className="rounded border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
                {suspendError}
              </div>
            ) : null}

            <div>
              <label htmlFor="suspend-reason-type" className="block text-sm font-medium text-foreground">
                Violation Type
              </label>
              <select
                id="suspend-reason-type"
                value={suspendReasonType}
                onChange={(e) => setSuspendReasonType(e.target.value)}
                className="mt-1 h-9 w-full rounded border border-border bg-background px-3 text-sm focus:outline-hidden"
              >
                <option value="tos_violation">Terms of Service / Policy Violation</option>
                <option value="fraud">Fraud / High Risk</option>
              </select>
            </div>

            <div>
              <label htmlFor="suspend-reason" className="block text-sm font-medium text-foreground">
                Reason for suspension <span className="text-red-500">*</span>
              </label>
              <Textarea
                id="suspend-reason"
                placeholder="Describe the reason for suspension (recorded in audit logs)..."
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                className="mt-1 min-h-[90px]"
                rows={3}
                required
              />
              <p className="text-muted-foreground mt-1 text-xs">
                This note will be attached to the account audit record.
              </p>
            </div>
          </div>
        </Modal>

        {/* Unsuspend Modal */}
        <Modal
          open={unsuspendModalOpen}
          onClose={() => {
            if (!unsuspendSubmitting) {
              setUnsuspendModalOpen(false);
            }
          }}
          title="Unsuspend Creator Account"
          footer={
            <div className="flex items-center gap-3">
              <Button type="button" outline disabled={unsuspendSubmitting} onClick={() => setUnsuspendModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                color="primary"
                disabled={unsuspendSubmitting || !unsuspendReason.trim()}
                onClick={handleUnsuspendSubmit}
              >
                {unsuspendSubmitting ? "Unsuspending..." : "Lift Suspension"}
              </Button>
            </div>
          }
        >
          <Dialog.Description className="sr-only">
            Modal to lift creator account suspension with mandatory reason.
          </Dialog.Description>
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Lifting the suspension will mark this creator compliant, re-enable active product listings, and restore
              store functionality.
            </p>

            {unsuspendError ? (
              <div className="rounded border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
                {unsuspendError}
              </div>
            ) : null}

            <div>
              <label htmlFor="unsuspend-reason" className="block text-sm font-medium text-foreground">
                Reason for lifting suspension <span className="text-red-500">*</span>
              </label>
              <Textarea
                id="unsuspend-reason"
                placeholder="Enter justification for lifting suspension..."
                value={unsuspendReason}
                onChange={(e) => setUnsuspendReason(e.target.value)}
                className="mt-1 min-h-[90px]"
                rows={3}
                required
              />
              <p className="text-muted-foreground mt-1 text-xs">This note will be recorded in the audit log.</p>
            </div>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
}
