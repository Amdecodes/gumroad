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
import { useTranslation } from "$app/utils/i18n";

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

const renderCreatorStatusPill = (
  status: string,
  t?: (key: string, vars?: Record<string, any>, defaultVal?: string) => string,
) => {
  const translate = t || ((_k: string, _v?: any, d?: string) => d || "");
  switch (status) {
    case "active":
      return (
        <Pill color="success" size="small">
          {translate("admin.status.active", undefined, "Active")}
        </Pill>
      );
    case "suspended":
      return (
        <Pill color="danger" size="small">
          {translate("admin.status.suspended", undefined, "Suspended")}
        </Pill>
      );
    case "deleted":
      return (
        <Pill color="warning" size="small">
          {translate("admin.status.deleted", undefined, "Deleted")}
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
  const { t } = useTranslation();
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
              <span>{t("admin.creators_page.back_to_creators", undefined, "Back to creators")}</span>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href={impersonate_url}
              className="inline-flex items-center gap-1.5 rounded border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground no-underline transition-colors hover:bg-muted"
            >
              <UserCheck className="text-muted-foreground size-4" />
              <span>{t("admin.creators_page.impersonate", undefined, "Impersonate")}</span>
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
                {t("admin.creators_page.unsuspend_creator", undefined, "Unsuspend Creator")}
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
                {t("admin.creators_page.suspend_creator", undefined, "Suspend Creator")}
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
                    {renderCreatorStatusPill(profile.status, t)}
                    {profile.verified_status ? (
                      <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                        <CheckCircle className="size-3.5" />
                        {t("admin.creators_page.verified", undefined, "Verified")}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-muted-foreground flex flex-wrap items-center gap-3 pt-1 text-sm">
                    <span>
                      {profile.username
                        ? `@${profile.username}`
                        : t("admin.creators_page.no_username", undefined, "No username")}
                    </span>
                    <span>•</span>
                    <span>{profile.email}</span>
                    <span>•</span>
                    <span>
                      {t(
                        "admin.creators_page.joined_date",
                        { date: formatDate(profile.joined_at) },
                        `Joined ${formatDate(profile.joined_at)}`,
                      )}
                    </span>
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
                <span className="text-muted-foreground text-xs font-medium uppercase">
                  {t("admin.creators_page.lifetime_volume", undefined, "Lifetime Volume")}
                </span>
                <DollarCircle className="text-muted-foreground size-5 opacity-70" />
              </div>
              <p className="mt-2 text-2xl font-bold text-foreground">{metrics.formatted_lifetime_revenue}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium uppercase">
                  {t("admin.creators_page.total_sales", undefined, "Total Sales")}
                </span>
                <Package className="text-muted-foreground size-5 opacity-70" />
              </div>
              <p className="mt-2 text-2xl font-bold text-foreground">{metrics.sales_count}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium uppercase">
                  {t("admin.creators_page.active_products", undefined, "Active Products")}
                </span>
                <Store className="text-muted-foreground size-5 opacity-70" />
              </div>
              <p className="mt-2 text-2xl font-bold text-foreground">{metrics.active_products_count}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium uppercase">
                  {t("admin.creators_page.customers", undefined, "Customers")}
                </span>
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
            <div className="border-b border-border p-4 text-base font-semibold">
              {t("admin.creators_page.profile_details", undefined, "Profile & Account Details")}
            </div>
            <CardContent className="divide-y divide-border p-0 text-sm">
              <div className="flex items-center justify-between p-4">
                <span className="text-muted-foreground">
                  {t("admin.creators_page.external_id", undefined, "External ID")}
                </span>
                <span className="font-mono text-xs text-foreground">{profile.external_id}</span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-muted-foreground">
                  {t("admin.creators_page.username", undefined, "Username")}
                </span>
                <span className="font-medium text-foreground">{profile.username ? `@${profile.username}` : "—"}</span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-muted-foreground">{t("admin.creators_page.email", undefined, "Email")}</span>
                <span className="font-medium text-foreground">{profile.email}</span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-muted-foreground">{t("admin.creators_page.bio", undefined, "Bio")}</span>
                <span className="text-muted-foreground max-w-xs truncate text-right">
                  {profile.bio || t("admin.creators_page.none_provided", undefined, "None provided")}
                </span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-muted-foreground">
                  {t("admin.creators_page.account_status", undefined, "Account Status")}
                </span>
                <div>{renderCreatorStatusPill(profile.status, t)}</div>
              </div>
            </CardContent>
          </Card>

          {/* Compliance & Payout Information */}
          <Card>
            <div className="border-b border-border p-4 text-base font-semibold">
              {t("admin.creators_page.compliance_payout_status", undefined, "Compliance & Payout Status")}
            </div>
            <CardContent className="divide-y divide-border p-0 text-sm">
              <div className="flex items-center justify-between p-4">
                <span className="text-muted-foreground">
                  {t("admin.creators_page.payout_setup", undefined, "Payout Setup")}
                </span>
                <span className="font-medium">
                  {payment_info.payout_setup ? (
                    <span className="text-green-600 dark:text-green-400">
                      {t("admin.creators_page.configured", undefined, "Configured")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {t("admin.creators_page.not_configured", undefined, "Not Configured")}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-muted-foreground">
                  {t("admin.creators_page.payouts_standing", undefined, "Payouts Standing")}
                </span>
                <span>
                  {payment_info.payouts_paused ? (
                    <Pill color="danger" size="small">
                      {t(
                        "admin.creators_page.paused_reason",
                        {
                          reason:
                            payment_info.payouts_paused_reason ||
                            t("admin.creators_page.administrative_hold", undefined, "Administrative hold"),
                        },
                        `Paused: ${payment_info.payouts_paused_reason || "Administrative hold"}`,
                      )}
                    </Pill>
                  ) : (
                    <Pill color="success" size="small">
                      {t("admin.status.active", undefined, "Active")}
                    </Pill>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-muted-foreground">
                  {t("admin.creators_page.payout_email", undefined, "Payout Email (PayPal)")}
                </span>
                <span className="font-medium text-foreground">{payment_info.paypal_email || "—"}</span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-muted-foreground">
                  {t("admin.creators_page.payment_address", undefined, "Payment Address")}
                </span>
                <span className="font-medium text-foreground">{payment_info.payment_address || "—"}</span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-muted-foreground">
                  {t("admin.creators_page.compliance_verified", undefined, "Compliance Verified")}
                </span>
                <span>
                  {payment_info.verified ? (
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {t("admin.creators_page.yes", undefined, "Yes")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {t("admin.creators_page.unverified", undefined, "Unverified")}
                    </span>
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Products Table */}
        <Card>
          <div className="border-b border-border p-4 text-base font-semibold">
            {t("admin.creators_page.recent_products", undefined, "Recent Products")}
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.creators_page.product_title", undefined, "Product Title")}</TableHead>
                  <TableHead>{t("admin.creators_page.price", undefined, "Price")}</TableHead>
                  <TableHead>{t("admin.creators_page.sales", undefined, "Sales")}</TableHead>
                  <TableHead>{t("admin.table.status", undefined, "Status")}</TableHead>
                  <TableHead>{t("admin.creators_page.published_date", undefined, "Published Date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground h-32 text-center">
                      {t("admin.creators_page.no_products", undefined, "No products found for this creator.")}
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
                          {product.status === "published"
                            ? t("admin.status.published", undefined, "published")
                            : product.status}
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
            <div className="border-b border-border p-4 text-base font-semibold">
              {t("admin.creators_page.recent_actions", undefined, "Recent Administrative Actions")}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.table.action", undefined, "Action")}</TableHead>
                    <TableHead>{t("admin.creators_page.admin_actor", undefined, "Admin Actor")}</TableHead>
                    <TableHead>{t("admin.table.status", undefined, "Status")}</TableHead>
                    <TableHead>{t("admin.creators_page.timestamp", undefined, "Timestamp")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit_history.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">{log.action}</TableCell>
                      <TableCell>{log.actor_name}</TableCell>
                      <TableCell>
                        <span className="text-xs font-medium">
                          {log.response_status
                            ? `HTTP ${log.response_status}`
                            : t("admin.creators_page.completed", undefined, "Completed")}
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
          title={t("admin.creators_page.suspend_modal_title", undefined, "Suspend Creator Account")}
          footer={
            <div className="flex items-center gap-3">
              <Button type="button" outline disabled={suspendSubmitting} onClick={() => setSuspendModalOpen(false)}>
                {t("admin.creators_page.cancel", undefined, "Cancel")}
              </Button>
              <Button
                type="button"
                color="danger"
                disabled={suspendSubmitting || !suspendReason.trim()}
                onClick={handleSuspendSubmit}
              >
                {suspendSubmitting
                  ? t("admin.creators_page.suspending", undefined, "Suspending...")
                  : t("admin.creators_page.confirm_suspension", undefined, "Confirm Suspension")}
              </Button>
            </div>
          }
        >
          <Dialog.Description className="sr-only">
            Modal to suspend creator account with mandatory reason.
          </Dialog.Description>
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              {t(
                "admin.creators_page.suspend_warning",
                undefined,
                "Suspending this creator will disable their store listings, prevent future purchases, and pause payout distributions.",
              )}
            </p>

            {suspendError ? (
              <div className="rounded border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
                {suspendError}
              </div>
            ) : null}

            <div>
              <label htmlFor="suspend-reason-type" className="block text-sm font-medium text-foreground">
                {t("admin.creators_page.violation_type", undefined, "Violation Type")}
              </label>
              <select
                id="suspend-reason-type"
                value={suspendReasonType}
                onChange={(e) => setSuspendReasonType(e.target.value)}
                className="mt-1 h-9 w-full rounded border border-border bg-background px-3 text-sm focus:outline-hidden"
              >
                <option value="tos_violation">
                  {t("admin.creators_page.tos_violation", undefined, "Terms of Service / Policy Violation")}
                </option>
                <option value="fraud">{t("admin.creators_page.fraud_risk", undefined, "Fraud / High Risk")}</option>
              </select>
            </div>

            <div>
              <label htmlFor="suspend-reason" className="block text-sm font-medium text-foreground">
                {t("admin.creators_page.reason_for_suspension", undefined, "Reason for suspension")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <Textarea
                id="suspend-reason"
                placeholder={t(
                  "admin.creators_page.suspend_reason_placeholder",
                  undefined,
                  "Describe the reason for suspension (recorded in audit logs)...",
                )}
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                className="mt-1 min-h-[90px]"
                rows={3}
                required
              />
              <p className="text-muted-foreground mt-1 text-xs">
                {t(
                  "admin.creators_page.suspend_audit_note",
                  undefined,
                  "This note will be attached to the account audit record.",
                )}
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
          title={t("admin.creators_page.unsuspend_modal_title", undefined, "Unsuspend Creator Account")}
          footer={
            <div className="flex items-center gap-3">
              <Button type="button" outline disabled={unsuspendSubmitting} onClick={() => setUnsuspendModalOpen(false)}>
                {t("admin.creators_page.cancel", undefined, "Cancel")}
              </Button>
              <Button
                type="button"
                color="primary"
                disabled={unsuspendSubmitting || !unsuspendReason.trim()}
                onClick={handleUnsuspendSubmit}
              >
                {unsuspendSubmitting
                  ? t("admin.creators_page.unsuspending", undefined, "Unsuspending...")
                  : t("admin.creators_page.lift_suspension", undefined, "Lift Suspension")}
              </Button>
            </div>
          }
        >
          <Dialog.Description className="sr-only">
            Modal to lift creator account suspension with mandatory reason.
          </Dialog.Description>
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              {t(
                "admin.creators_page.unsuspend_warning",
                undefined,
                "Lifting the suspension will mark this creator compliant, re-enable active product listings, and restore store functionality.",
              )}
            </p>

            {unsuspendError ? (
              <div className="rounded border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
                {unsuspendError}
              </div>
            ) : null}

            <div>
              <label htmlFor="unsuspend-reason" className="block text-sm font-medium text-foreground">
                {t("admin.creators_page.reason_for_lifting", undefined, "Reason for lifting suspension")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <Textarea
                id="unsuspend-reason"
                placeholder={t(
                  "admin.creators_page.unsuspend_reason_placeholder",
                  undefined,
                  "Enter justification for lifting suspension...",
                )}
                value={unsuspendReason}
                onChange={(e) => setUnsuspendReason(e.target.value)}
                className="mt-1 min-h-[90px]"
                rows={3}
                required
              />
              <p className="text-muted-foreground mt-1 text-xs">
                {t(
                  "admin.creators_page.unsuspend_audit_note",
                  undefined,
                  "This note will be recorded in the audit log.",
                )}
              </p>
            </div>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
}
