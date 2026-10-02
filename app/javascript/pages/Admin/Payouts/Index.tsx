import { CheckCircle, DollarCircle, Filter, Search, Timer, User, X } from "@boxicons/react";
import { Link, router } from "@inertiajs/react";
import * as React from "react";

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

const renderPayoutStatusPill = (status: string) => {
  switch (status.toLowerCase()) {
    case "completed":
      return (
        <Pill color="success" size="small">
          Completed
        </Pill>
      );
    case "pending":
    case "processing":
    case "unclaimed":
    case "held":
    case "flagged":
      return (
        <Pill color="warning" size="small">
          Pending
        </Pill>
      );
    case "failed":
      return (
        <Pill color="danger" size="small">
          Failed
        </Pill>
      );
    case "cancelled":
      return <Pill size="small">Cancelled</Pill>;
    default:
      return <Pill size="small">{status}</Pill>;
  }
};

export default function Index({ payouts, pagy, metrics, filters }: PayoutsIndexProps) {
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
        <PageHeader title="Payouts">
          <p className="text-muted-foreground text-sm">
            Review creator payout requests, release manual payouts, and track bank transfers.
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
                <div className="text-xs font-medium tracking-wider text-muted uppercase">Pending Payouts</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-foreground">
                    {metrics.formatted_pending_amount}
                  </span>
                  <span className="text-xs font-semibold text-muted">
                    ({metrics.pending_count} {metrics.pending_count === 1 ? "payout" : "payouts"})
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
                <div className="text-xs font-medium tracking-wider text-muted uppercase">Completed (Last 30 Days)</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-foreground">
                    {metrics.formatted_completed_amount_30d}
                  </span>
                  <span className="text-xs font-semibold text-muted">
                    ({metrics.completed_count_30d} {metrics.completed_count_30d === 1 ? "payout" : "payouts"})
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
                  placeholder="Search by creator name, email, or payout reference..."
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
                    aria-label="Filter by status"
                    className="h-10 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground focus:ring-2 focus:ring-accent focus:outline-hidden"
                  >
                    <option value="all">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <Button type="submit" outline>
                  <Filter className="mr-1.5 size-4" />
                  Filter
                </Button>

                {hasActiveFilters ? (
                  <Button type="button" outline onClick={handleClearFilters} aria-label="Reset filters">
                    <X className="mr-1.5 size-4" />
                    Reset
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
                  <TableHead>Payout Reference</TableHead>
                  <TableHead>Creator</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Destination Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-muted">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <DollarCircle className="size-8 text-muted/50" />
                        <div className="text-base font-medium text-foreground">No payouts found</div>
                        <div className="text-sm">
                          {hasActiveFilters
                            ? "Try adjusting or clearing your search and filters."
                            : "There are currently no recorded payouts."}
                        </div>
                        {hasActiveFilters ? (
                          <Button type="button" outline className="mt-2" onClick={handleClearFilters}>
                            Clear filters
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
                          <span className="text-sm text-muted">Unknown creator</span>
                        )}
                      </TableCell>

                      {/* Amount */}
                      <TableCell className="font-semibold text-foreground">{payout.formatted_amount}</TableCell>

                      {/* Destination Method */}
                      <TableCell className="text-sm text-muted">{payout.destination_method}</TableCell>

                      {/* Status */}
                      <TableCell>{renderPayoutStatusPill(payout.status)}</TableCell>

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
                Showing page <span className="font-medium text-foreground">{pagy.page}</span> of{" "}
                <span className="font-medium text-foreground">{pagy.pages}</span> ({pagy.count} payouts)
              </p>
              <Pagination pagination={{ page: pagy.page, pages: pagy.pages }} onChangePage={handlePageChange} />
            </div>
          ) : null}
        </Card>
      </div>
    </AdminLayout>
  );
}
