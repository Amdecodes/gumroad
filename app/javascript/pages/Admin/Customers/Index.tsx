import { Group, Search, X } from "@boxicons/react";
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

export type CustomerSummary = {
  id: string;
  email: string;
  name?: string | null;
  orders_count: number;
  total_spent_cents: number;
  total_spent_formatted: string;
  active_subscriptions_count: number;
  is_registered: boolean;
  user_id?: string | null;
  last_seen_at?: string | null;
};

export type CustomersIndexProps = {
  customers: CustomerSummary[];
  pagination: PaginationProps & { count: number; has_more: boolean };
  filters: {
    q?: string;
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

export default function CustomersIndex({ customers, pagination, filters }: CustomersIndexProps) {
  const [query, setQuery] = React.useState(filters.q || "");

  const hasActiveFilters = Boolean(filters.q);

  const applyFilters = (newParams: { q?: string; page?: number }) => {
    const params: Record<string, string | number> = {};

    const qVal = newParams.q !== undefined ? newParams.q : query;
    const pageVal = newParams.page !== undefined ? newParams.page : 1;

    if (qVal.trim()) params.q = qVal.trim();
    if (pageVal > 1) params.page = pageVal;

    router.get("/admin/customers", params, {
      preserveState: true,
      preserveScroll: true,
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters({ page: 1 });
  };

  const handleClearFilters = () => {
    setQuery("");
    router.get("/admin/customers", {}, { preserveState: true, preserveScroll: true });
  };

  return (
    <AdminLayout currentPath="/admin/customers">
      <div className="space-y-6">
        <PageHeader title="Customers">
          <p className="text-sm text-muted">
            {`Showing ${customers.length} of ${pagination.count.toLocaleString()} customers across ArifDrop.`}
          </p>
        </PageHeader>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Search customers by email, name..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                  aria-label="Search customers"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button type="submit" color="primary" size="sm">
                  Search
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
            {customers.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <Group className="text-muted-foreground/40 mb-3 size-12" />
                <h3 className="text-base font-semibold text-foreground">No customers found</h3>
                <p className="text-muted-foreground mt-1 max-w-sm text-sm">
                  {hasActiveFilters
                    ? "No customers match your current search query. Try searching by another email or clearing the query."
                    : "No customers have made purchases on the platform yet."}
                </p>
                {hasActiveFilters ? (
                  <Button outline size="sm" onClick={handleClearFilters} className="mt-4">
                    Clear Search
                  </Button>
                ) : null}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Account Status</TableHead>
                    <TableHead>Total Orders</TableHead>
                    <TableHead>Total Spent</TableHead>
                    <TableHead>Active Subscriptions</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((cust) => (
                    <TableRow key={cust.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <Link
                          href={`/admin/customers/${cust.id}`}
                          className="font-semibold text-foreground hover:text-accent hover:underline"
                        >
                          {cust.email}
                        </Link>
                        {cust.name ? <div className="text-muted-foreground text-xs">{cust.name}</div> : null}
                      </TableCell>

                      <TableCell>
                        {cust.is_registered ? (
                          <Pill color="success" size="small">
                            Registered User
                          </Pill>
                        ) : (
                          <Pill size="small">Guest Buyer</Pill>
                        )}
                      </TableCell>

                      <TableCell>
                        <span className="text-sm font-semibold text-foreground">{cust.orders_count}</span>
                      </TableCell>

                      <TableCell>
                        <span className="text-sm font-semibold text-foreground">{cust.total_spent_formatted}</span>
                      </TableCell>

                      <TableCell>
                        {cust.active_subscriptions_count > 0 ? (
                          <Pill color="success" size="small">
                            {cust.active_subscriptions_count} Active
                          </Pill>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>

                      <TableCell className="text-muted-foreground text-sm">{formatDate(cust.last_seen_at)}</TableCell>

                      <TableCell className="text-right">
                        <Link
                          href={`/admin/customers/${cust.id}`}
                          className="text-sm font-medium text-accent hover:underline"
                        >
                          Inspect Customer
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
