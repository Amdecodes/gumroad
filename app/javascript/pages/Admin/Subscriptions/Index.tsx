import { Filter, Repeat, Search, X } from "@boxicons/react";
import { Link, router } from "@inertiajs/react";
import * as React from "react";

import { AdminLayout } from "$app/components/Admin/AdminLayout";
import { Button } from "$app/components/Button";
import { Pagination, type PaginationProps } from "$app/components/Pagination";
import { Card, CardContent } from "$app/components/ui/Card";
import { Input } from "$app/components/ui/Input";
import { PageHeader } from "$app/components/ui/PageHeader";
import { Pill } from "$app/components/ui/Pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$app/components/ui/Table";

export type SubscriptionSummary = {
  id: string;
  subscriber_email: string;
  subscriber_name?: string | null;
  product_name: string;
  product_id?: string | null;
  seller_name: string;
  seller_id?: string | null;
  amount_formatted: string;
  frequency: string;
  status: "active" | "failing" | "cancelled" | "deactivated" | string;
  created_at: string;
  current_period_end?: string | null;
};

export type SubscriptionsIndexProps = {
  subscriptions: SubscriptionSummary[];
  pagination: PaginationProps & { count: number; has_more: boolean };
  filters: {
    q?: string;
    status?: string;
  };
};

const formatSubDate = (isoString?: string | null) => {
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

const renderSubscriptionStatusPill = (status: string) => {
  switch (status) {
    case "active":
      return (
        <Pill color="success" size="small">
          Active
        </Pill>
      );
    case "failing":
      return (
        <Pill color="warning" size="small">
          Failing / Grace
        </Pill>
      );
    case "cancelled":
      return (
        <Pill color="danger" size="small">
          Cancelled
        </Pill>
      );
    case "deactivated":
      return <Pill size="small">Expired / Deactivated</Pill>;
    default:
      return <Pill size="small">{status}</Pill>;
  }
};

export default function SubscriptionsIndex({ subscriptions, pagination, filters }: SubscriptionsIndexProps) {
  const [query, setQuery] = React.useState(filters.q || "");
  const [status, setStatus] = React.useState(filters.status || "");

  const hasActiveFilters = Boolean(filters.q || filters.status);

  const applyFilters = (newParams: { q?: string; status?: string; page?: number }) => {
    const params: Record<string, string | number> = {};

    const qVal = newParams.q !== undefined ? newParams.q : query;
    const statusVal = newParams.status !== undefined ? newParams.status : status;
    const pageVal = newParams.page !== undefined ? newParams.page : 1;

    if (qVal.trim()) params.q = qVal.trim();
    if (statusVal) params.status = statusVal;
    if (pageVal > 1) params.page = pageVal;

    router.get("/admin/subscriptions", params, {
      preserveState: true,
      preserveScroll: true,
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters({ page: 1 });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextStatus = e.target.value;
    setStatus(nextStatus);
    applyFilters({ status: nextStatus, page: 1 });
  };

  const handleClearFilters = () => {
    setQuery("");
    setStatus("");
    router.get("/admin/subscriptions", {}, { preserveState: true, preserveScroll: true });
  };

  return (
    <AdminLayout currentPath="/admin/subscriptions">
      <div className="space-y-6">
        <PageHeader title="Subscriptions">
          <p className="text-sm text-muted">
            {`Showing ${subscriptions.length} of ${pagination.count.toLocaleString()} subscriptions across the platform.`}
          </p>
        </PageHeader>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Search by subscriber, product, creator, or ID..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                  aria-label="Search subscriptions"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <select
                    value={status}
                    onChange={handleStatusChange}
                    className="border-input flex h-9 items-center rounded-md border bg-background px-3 py-1 text-sm text-foreground shadow-xs focus:ring-1 focus:ring-accent focus:outline-hidden"
                    aria-label="Filter by subscription status"
                  >
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="failing">Failing / Grace Period</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="deactivated">Expired / Deactivated</option>
                  </select>
                </div>

                <Button type="submit" color="primary" size="sm">
                  <Filter className="mr-1.5 size-4" />
                  Filter
                </Button>

                {hasActiveFilters ? (
                  <Button type="button" outline size="sm" onClick={handleClearFilters} aria-label="Clear filters">
                    <X className="mr-1 size-4" />
                    Clear
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {subscriptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <Repeat className="text-muted-foreground/40 mb-3 size-12" />
                <h3 className="text-base font-semibold text-foreground">No subscriptions found</h3>
                <p className="text-muted-foreground mt-1 max-w-sm text-sm">
                  {hasActiveFilters
                    ? "No subscriptions match your current search or filter criteria. Try clearing filters to see all subscriptions."
                    : "No subscriptions have been created on the platform yet."}
                </p>
                {hasActiveFilters ? (
                  <Button outline size="sm" onClick={handleClearFilters} className="mt-4">
                    Clear Filters
                  </Button>
                ) : null}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subscriber</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Creator</TableHead>
                    <TableHead>Amount & Recurrence</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Period End / Next Renewal</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map((sub) => (
                    <TableRow key={sub.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <Link
                          href={`/admin/subscriptions/${sub.id}`}
                          className="font-semibold text-foreground hover:text-accent hover:underline"
                        >
                          {sub.subscriber_email}
                        </Link>
                        {sub.subscriber_name ? (
                          <div className="text-muted-foreground text-xs">{sub.subscriber_name}</div>
                        ) : null}
                      </TableCell>

                      <TableCell>
                        <div className="max-w-[200px] truncate text-sm font-medium text-foreground">
                          {sub.product_name}
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="text-muted-foreground text-sm">{sub.seller_name}</span>
                      </TableCell>

                      <TableCell>
                        <div className="text-sm font-semibold text-foreground">{sub.amount_formatted}</div>
                        <div className="text-muted-foreground text-xs capitalize">{sub.frequency}</div>
                      </TableCell>

                      <TableCell>{renderSubscriptionStatusPill(sub.status)}</TableCell>

                      <TableCell className="text-muted-foreground text-sm">
                        {formatSubDate(sub.current_period_end)}
                      </TableCell>

                      <TableCell className="text-muted-foreground text-sm">{formatSubDate(sub.created_at)}</TableCell>

                      <TableCell className="text-right">
                        <Link
                          href={`/admin/subscriptions/${sub.id}`}
                          className="text-sm font-medium text-accent hover:underline"
                        >
                          View Details
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {pagination.pages > 1 ? (
          <div className="flex justify-center">
            <Pagination
              pagination={{ page: pagination.page, pages: pagination.pages }}
              onChangePage={(nextPage) => applyFilters({ page: nextPage })}
            />
          </div>
        ) : null}
      </div>
    </AdminLayout>
  );
}
