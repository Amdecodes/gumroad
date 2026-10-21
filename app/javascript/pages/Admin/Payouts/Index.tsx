import { CheckCircle, DollarCircle, Filter, Search, Timer, User, X } from "@boxicons/react";
import { Link, router } from "@inertiajs/react";
import * as React from "react";

import { useTranslation, type TranslationFn } from "$app/utils/i18n";

import { AdminLayout } from "$app/components/Admin/AdminLayout";
import { Button } from "$app/components/Button";
import { Pagination } from "$app/components/Pagination";
import { Card, CardContent } from "$app/components/ui/Card";
import { Input } from "$app/components/ui/Input";
import { PageHeader } from "$app/components/ui/PageHeader";
import { Pill } from "$app/components/ui/Pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$app/components/ui/Table";

export type PayoutCreator = {
  external_id: string;
  name: string;
  username: string;
  email: string;
  avatar_url?: string;
  admin_path: string;
};

export type PayoutSummary = {
  id: string;
  external_id: string;
  reference: string;
  amount_cents: number;
  formatted_amount: string;
  currency: string;
  status: string;
  destination_method: string;
  created_at: string;
  creator?: PayoutCreator | null;
};

export type PayoutMetrics = {
  pending_count: number;
  pending_amount_cents: number;
  formatted_pending_amount: string;
  completed_count_30d: number;
  completed_amount_cents_30d: number;
  formatted_completed_amount_30d: string;
};

export type PayoutsIndexProps = {
  payouts: PayoutSummary[];
  pagy: {
    page: number;
    pages: number;
    count: number;
    next_page?: number | null;
    prev_page?: number | null;
    has_more: boolean;
  };
  metrics: PayoutMetrics;
  filters: {
    q?: string;
    status?: string;
  };
  current_admin?: {
    name: string;
    email: string;
  };
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

const renderPayoutStatusPill = (status: string, t?: TranslationFn) => {
  const translate = t || ((_k: string, _v?: unknown, d?: string) => d || "");
  switch (status.toLowerCase()) {
    case "completed":
      return (
        <Pill color="success" size="small">
          {translate("admin.status.completed", undefined, "Completed")}
        </Pill>
      );
    case "pending":
    case "processing":
    case "unclaimed":
    case "held":
    case "flagged":
      return (
        <Pill color="warning" size="small">
          {translate("admin.status.pending", undefined, "Pending")}
        </Pill>
      );
    case "failed":
      return (
        <Pill color="danger" size="small">
          {translate("admin.status.failed", undefined, "Failed")}
        </Pill>
      );
    case "cancelled":
      return <Pill size="small">{translate("admin.status.cancelled", undefined, "Cancelled")}</Pill>;
    default:
      return <Pill size="small">{status}</Pill>;
  }
};

export default function Index({ payouts, pagy, metrics, filters }: PayoutsIndexProps) {
  const { t } = useTranslation();
  const [query, setQuery] = React.useState(filters.q || "");
  const [status, setStatus] = React.useState(filters.status || "all");

  const hasActiveFilters = Boolean((filters.q && filters.q.length > 0) || (filters.status && filters.status !== "all"));

  const applyFilters = (newParams: { q?: string; status?: string; page?: number }) => {
    const params: Record<string, string | number> = {};

    const qVal = newParams.q !== undefined ? newParams.q : query;
    const statusVal = newParams.status !== undefined ? newParams.status : status;
    const pageVal = newParams.page !== undefined ? newParams.page : 1;

    if (qVal) params.q = qVal;
    if (statusVal && statusVal !== "all") params.status = statusVal;
    if (pageVal > 1) params.page = pageVal;

    router.get("/admin/payouts", params, {
      preserveState: true,
      preserveScroll: true,
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters({ q: query, page: 1 });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    setStatus(newStatus);
    applyFilters({ status: newStatus, page: 1 });
  };

  const handleClearFilters = () => {
    setQuery("");
    setStatus("all");
    router.get("/admin/payouts", {}, { preserveState: true, preserveScroll: true });
  };

  const handlePageChange = (newPage: number) => {
    applyFilters({ page: newPage });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader title={t("admin.payouts", {}, "Payouts")}>
          <p className="text-muted-foreground text-sm">
            {t(
              "admin.payouts_page.subtitle",
              {},
              "Review creator payout requests, release manual payouts, and track bank transfers.",
            )}
          </p>
        </PageHeader>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <Timer className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium tracking-wider text-muted uppercase">
                  {t("admin.payouts_page.pending_payouts", {}, "Pending Payouts")}
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-foreground">
                    {metrics.formatted_pending_amount}
                  </span>
                  <span className="text-xs font-semibold text-muted">
                    ({metrics.pending_count}{" "}
                    {metrics.pending_count === 1
                      ? t("admin.payouts_page.payout", {}, "payout")
                      : t("admin.payouts_page.payouts", {}, "payouts")}
                    )
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                <CheckCircle className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium tracking-wider text-muted uppercase">
                  {t("admin.payouts_page.completed_30d", {}, "Completed (Last 30 Days)")}
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-foreground">
                    {metrics.formatted_completed_amount_30d}
                  </span>
                  <span className="text-xs font-semibold text-muted">
                    ({metrics.completed_count_30d}{" "}
                    {metrics.completed_count_30d === 1
                      ? t("admin.payouts_page.payout", {}, "payout")
                      : t("admin.payouts_page.payouts", {}, "payouts")}
                    )
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar */}
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-[240px] flex-1">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
                <Input
                  type="text"
                  placeholder={t(
                    "admin.payouts_page.search_placeholder",
                    {},
                    "Search by creator name, email, or payout reference...",
                  )}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <select
                    value={status}
                    onChange={handleStatusChange}
                    aria-label={t("admin.payouts_page.filter_by_status", {}, "Filter by status")}
                    className="h-10 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground focus:ring-2 focus:ring-accent focus:outline-hidden"
                  >
                    <option value="all">{t("admin.payouts_page.all_statuses", {}, "All statuses")}</option>
                    <option value="pending">{t("admin.status.pending", {}, "Pending")}</option>
                    <option value="completed">{t("admin.status.completed", {}, "Completed")}</option>
                    <option value="failed">{t("admin.status.failed", {}, "Failed")}</option>
                    <option value="cancelled">{t("admin.status.cancelled", {}, "Cancelled")}</option>
                  </select>
                </div>

                <Button type="submit" outline>
                  <Filter className="mr-1.5 size-4" />
                  {t("admin.payouts_page.filter", {}, "Filter")}
                </Button>

                {hasActiveFilters ? (
                  <Button
                    type="button"
                    outline
                    onClick={handleClearFilters}
                    aria-label={t("admin.payouts_page.reset", {}, "Reset filters")}
                  >
                    <X className="mr-1.5 size-4" />
                    {t("admin.payouts_page.reset", {}, "Reset")}
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Payouts Table */}
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.payouts_page.payout_reference", {}, "Payout Reference")}</TableHead>
                  <TableHead>{t("admin.payouts_page.creator", {}, "Creator")}</TableHead>
                  <TableHead>{t("admin.table.amount", {}, "Amount")}</TableHead>
                  <TableHead>{t("admin.payouts_page.destination_method", {}, "Destination Method")}</TableHead>
                  <TableHead>{t("admin.table.status", {}, "Status")}</TableHead>
                  <TableHead>{t("admin.payouts_page.requested_date", {}, "Requested Date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-muted">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <DollarCircle className="size-8 text-muted/50" />
                        <div className="text-base font-medium text-foreground">
                          {t("admin.payouts_page.empty_title", {}, "No payouts found")}
                        </div>
                        <div className="text-sm">
                          {hasActiveFilters
                            ? t(
                                "admin.payouts_page.empty_filtered",
                                {},
                                "Try adjusting or clearing your search and filters.",
                              )
                            : t("admin.payouts_page.empty_unfiltered", {}, "There are currently no recorded payouts.")}
                        </div>
                        {hasActiveFilters ? (
                          <Button type="button" outline className="mt-2" onClick={handleClearFilters}>
                            {t("admin.payouts_page.clear_filters", {}, "Clear filters")}
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  payouts.map((payout) => (
                    <TableRow
                      key={payout.id}
                      className="cursor-pointer transition-colors hover:bg-muted/10"
                      onClick={() => router.visit(`/admin/payouts/${payout.external_id}`)}
                    >
                      {/* Payout Reference */}
                      <TableCell className="font-mono text-xs font-semibold text-foreground">
                        <Link
                          href={`/admin/payouts/${payout.external_id}`}
                          className="text-foreground no-underline hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {payout.reference}
                        </Link>
                      </TableCell>

                      {/* Creator */}
                      <TableCell>
                        {payout.creator ? (
                          <div className="flex items-center gap-3">
                            {payout.creator.avatar_url ? (
                              <img
                                src={payout.creator.avatar_url}
                                alt={payout.creator.name}
                                className="size-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex size-8 items-center justify-center rounded-full bg-accent/10 text-accent">
                                <User className="size-4" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <Link
                                href={payout.creator.admin_path}
                                className="truncate text-sm font-semibold text-foreground no-underline hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {payout.creator.name}
                              </Link>
                              <div className="truncate text-xs text-muted">
                                @{payout.creator.username || "creator"} · {payout.creator.email}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted">
                            {t("admin.payouts_page.unknown_creator", {}, "Unknown creator")}
                          </span>
                        )}
                      </TableCell>

                      {/* Amount */}
                      <TableCell className="font-semibold text-foreground">{payout.formatted_amount}</TableCell>

                      {/* Destination Method */}
                      <TableCell className="text-sm text-muted">{payout.destination_method}</TableCell>

                      {/* Status */}
                      <TableCell>{renderPayoutStatusPill(payout.status, t)}</TableCell>

                      {/* Requested Date */}
                      <TableCell className="text-sm text-muted">{formatDate(payout.created_at)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Bar */}
          {pagy.pages > 1 ? (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 sm:px-6">
              <p className="text-xs text-muted">
                {t(
                  "admin.payouts_page.showing_payouts",
                  { page: pagy.page, pages: pagy.pages, count: pagy.count },
                  `Showing page ${pagy.page} of ${pagy.pages} (${pagy.count} payouts)`,
                )}
              </p>
              <Pagination pagination={{ page: pagy.page, pages: pagy.pages }} onChangePage={handlePageChange} />
            </div>
          ) : null}
        </Card>
      </div>
    </AdminLayout>
  );
}
