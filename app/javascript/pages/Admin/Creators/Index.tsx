import { Filter, Search, User, X } from "@boxicons/react";
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

export type CreatorSummary = {
  external_id: string;
  username: string;
  display_name: string;
  email: string;
  avatar_url: string;
  product_count: number;
  total_sales_count: number;
  formatted_lifetime_volume: string;
  status: string;
  joined_at: string;
};

export type CreatorsIndexProps = {
  creators: CreatorSummary[];
  pagy: {
    page: number;
    pages: number;
    count: number;
    next_page?: number | null;
    prev_page?: number | null;
    has_more: boolean;
  };
  filters: {
    q?: string;
    status?: string;
  };
};

const formatJoinedDate = (isoString: string) => {
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

export default function Index({ creators, pagy, filters }: CreatorsIndexProps) {
  const [query, setQuery] = React.useState(filters.q || "");
  const [status, setStatus] = React.useState(filters.status || "");

  const hasActiveFilters = Boolean(filters.q || filters.status);

  const applyFilters = (newParams: { q?: string; status?: string; page?: number }) => {
    const params: Record<string, string | number> = {};

    const qVal = newParams.q !== undefined ? newParams.q : query;
    const statusVal = newParams.status !== undefined ? newParams.status : status;
    const pageVal = newParams.page !== undefined ? newParams.page : 1;

    if (qVal) params.q = qVal;
    if (statusVal) params.status = statusVal;
    if (pageVal > 1) params.page = pageVal;

    router.get("/admin/creators", params, {
      preserveState: true,
      preserveScroll: true,
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters({ q: query, page: 1 });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextStatus = e.target.value;
    setStatus(nextStatus);
    applyFilters({ status: nextStatus, page: 1 });
  };

  const clearFilters = () => {
    setQuery("");
    setStatus("");
    router.get("/admin/creators", {}, { preserveState: true, preserveScroll: true });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader title="Creators">
          <p className="text-muted-foreground text-sm">
            Manage creator accounts, store policies, and account standing.
          </p>
        </PageHeader>

        {/* Filter Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-2">
                <div className="relative max-w-md flex-1">
                  <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                  <Input
                    type="search"
                    placeholder="Search by name, @username, or email..."
                    className="pl-9"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <Button type="submit" size="sm" outline>
                  Search
                </Button>
              </form>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="text-muted-foreground size-4" />
                  <label htmlFor="status-filter" className="text-sm font-medium">
                    Status:
                  </label>
                  <select
                    id="status-filter"
                    aria-label="Status filter"
                    value={status}
                    onChange={handleStatusChange}
                    className="h-9 rounded border border-border bg-background px-3 text-sm focus:outline-hidden"
                  >
                    <option value="">All (Alive)</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="deleted">Deleted</option>
                  </select>
                </div>

                {hasActiveFilters ? (
                  <Button type="button" size="sm" outline onClick={clearFilters} className="flex items-center gap-1.5">
                    <X className="size-3.5" />
                    Reset
                  </Button>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Creators Table */}
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Creator</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Sales</TableHead>
                  <TableHead>Lifetime Volume</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creators.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <User className="size-8 opacity-40" />
                        <p className="text-base font-medium">No creators found</p>
                        <p className="text-sm">Try adjusting your search criteria or clearing filters.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  creators.map((creator) => {
                    const creatorId = creator.external_id || creator.username;
                    return (
                      <TableRow key={creator.external_id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <Link
                            href={`/admin/creators/${creatorId}`}
                            className="flex items-center gap-3 text-foreground no-underline"
                          >
                            <img
                              src={creator.avatar_url}
                              alt={creator.display_name}
                              className="size-9 rounded-full bg-muted object-cover"
                              onError={(e) => {
                                // fallback if image fails
                                e.currentTarget.style.display = "none";
                              }}
                            />
                            <div className="min-w-0">
                              <p className="truncate font-medium hover:text-accent">{creator.display_name}</p>
                              <p className="text-muted-foreground truncate text-xs">{creator.email}</p>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/admin/creators/${creatorId}`}
                            className="text-muted-foreground text-sm no-underline hover:text-foreground"
                          >
                            {creator.username ? `@${creator.username}` : "—"}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{creator.product_count}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{creator.total_sales_count}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">{creator.formatted_lifetime_volume}</span>
                        </TableCell>
                        <TableCell>{renderCreatorStatusPill(creator.status)}</TableCell>
                        <TableCell>
                          <span className="text-muted-foreground text-xs">{formatJoinedDate(creator.joined_at)}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagy.pages > 1 ? (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 sm:px-6">
              <p className="text-muted-foreground text-xs">
                Showing page <span className="font-medium text-foreground">{pagy.page}</span> of{" "}
                <span className="font-medium text-foreground">{pagy.pages}</span> ({pagy.count} creators)
              </p>
              <Pagination
                pagination={{ page: pagy.page, pages: pagy.pages }}
                onChangePage={(nextPage) => applyFilters({ page: nextPage })}
              />
            </div>
          ) : null}
        </Card>
      </div>
    </AdminLayout>
  );
}
