import { Filter, History, Search, X } from "@boxicons/react";
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

export type ActivityLogActor = {
  id?: string;
  name: string;
  email?: string;
};

export type ActivityLogItem = {
  id: string;
  action: string;
  humanized_action: string;
  actor: ActivityLogActor;
  target_type?: string | null;
  target_id?: string | null;
  target_external_id?: string | null;
  target_link?: string | null;
  route: string;
  http_method: string;
  response_status?: number | null;
  status: "success" | "failure";
  error_class?: string | null;
  created_at: string;
  formatted_created_at: string;
};

export type ActivityLogsIndexProps = {
  logs: ActivityLogItem[];
  pagy: {
    page: number;
    pages: number;
    count: number;
    next_page?: number | null;
    prev_page?: number | null;
    has_more: boolean;
  };
  available_actions: string[];
  available_actors: { id: string; name: string; email: string }[];
  filters: {
    q?: string | undefined;
    action_name?: string | undefined;
    actor?: string | undefined;
    status?: string | undefined;
  };
  current_admin?: {
    name: string;
    email: string;
  };
};

const renderStatusPill = (status: "success" | "failure", statusCode?: number | null) => {
  const codeLabel = statusCode ? `${statusCode}` : status;
  if (status === "success") {
    return (
      <Pill color="success" size="small">
        {codeLabel} OK
      </Pill>
    );
  }
  return (
    <Pill color="danger" size="small">
      {codeLabel} Error
    </Pill>
  );
};

export default function ActivityLogIndex({
  logs,
  pagy,
  available_actions,
  available_actors,
  filters,
}: ActivityLogsIndexProps) {
  const [searchQuery, setSearchQuery] = React.useState(filters.q || "");
  const [selectedAction, setSelectedAction] = React.useState(filters.action_name || "");
  const [selectedActor, setSelectedActor] = React.useState(filters.actor || "");
  const [selectedStatus, setSelectedStatus] = React.useState(filters.status || "");

  const applyFilters = (overrides: Record<string, string | undefined> = {}) => {
    const rawFilters: Record<string, string | undefined> = {
      q: searchQuery.trim() || undefined,
      action_name: selectedAction || undefined,
      actor: selectedActor || undefined,
      status: selectedStatus || undefined,
      ...overrides,
    };

    const nextFilters = Object.fromEntries(Object.entries(rawFilters).filter(([_, value]) => Boolean(value)));

    router.get("/admin/activity-log", nextFilters, {
      preserveState: true,
      preserveScroll: true,
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters();
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedAction("");
    setSelectedActor("");
    setSelectedStatus("");
    router.get("/admin/activity-log", {}, { preserveState: true });
  };

  const handlePageChange = (nextPage: number) => {
    applyFilters({ page: nextPage.toString() });
  };

  const hasActiveFilters = Boolean(searchQuery || selectedAction || selectedActor || selectedStatus);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader title="Activity Log">
          <p className="text-muted-foreground text-sm">
            Inspect all administrative actions and mutations executed across the platform.
          </p>
        </PageHeader>

        {/* Filter Toolbar */}
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-[240px] flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Search by action, route, target, or actor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  aria-label="Search activity logs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedAction}
                  onChange={(e) => {
                    setSelectedAction(e.target.value);
                    applyFilters({ action_name: e.target.value || undefined });
                  }}
                  className="border-input h-10 rounded-md border bg-background px-3 text-sm focus:ring-2 focus:ring-accent focus:outline-none"
                  aria-label="Filter by action"
                >
                  <option value="">All Actions</option>
                  {available_actions.map((act) => (
                    <option key={act} value={act}>
                      {act}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedActor}
                  onChange={(e) => {
                    setSelectedActor(e.target.value);
                    applyFilters({ actor: e.target.value || undefined });
                  }}
                  className="border-input h-10 rounded-md border bg-background px-3 text-sm focus:ring-2 focus:ring-accent focus:outline-none"
                  aria-label="Filter by actor"
                >
                  <option value="">All Actors</option>
                  {available_actors.map((actor) => (
                    <option key={actor.id} value={actor.id}>
                      {actor.name} ({actor.email})
                    </option>
                  ))}
                </select>

                <select
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    applyFilters({ status: e.target.value || undefined });
                  }}
                  className="border-input h-10 rounded-md border bg-background px-3 text-sm focus:ring-2 focus:ring-accent focus:outline-none"
                  aria-label="Filter by status"
                >
                  <option value="">All Statuses</option>
                  <option value="success">Success</option>
                  <option value="failure">Failed / Error</option>
                </select>

                <Button type="submit" color="primary">
                  <Filter className="mr-1.5 size-4" />
                  Filter
                </Button>

                {hasActiveFilters ? (
                  <Button type="button" onClick={handleClearFilters}>
                    <X className="mr-1.5 size-4" />
                    Clear
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Route & Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time (UTC)</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <History className="text-muted-foreground size-8" />
                        <p className="text-muted-foreground text-sm font-medium">No activity log entries found.</p>
                        {hasActiveFilters ? (
                          <Button size="sm" onClick={handleClearFilters}>
                            Clear filters
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="text-sm font-semibold text-foreground">{log.humanized_action}</div>
                          <div className="text-muted-foreground font-mono text-xs">{log.action}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.target_type ? (
                          <div className="space-y-0.5">
                            <span className="text-muted-foreground text-xs font-medium uppercase">
                              {log.target_type}
                            </span>
                            {log.target_link ? (
                              <div>
                                <Link href={log.target_link} className="font-mono text-xs text-accent hover:underline">
                                  {log.target_external_id || log.target_id}
                                </Link>
                              </div>
                            ) : (
                              <div className="font-mono text-xs text-foreground">
                                {log.target_external_id || log.target_id || "—"}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="text-sm font-medium text-foreground">{log.actor.name}</div>
                          {log.actor.email ? (
                            <div className="text-muted-foreground text-xs">{log.actor.email}</div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <span className="text-muted-foreground rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                            {log.http_method}
                          </span>
                          <div
                            className="text-muted-foreground max-w-[200px] truncate font-mono text-xs"
                            title={log.route}
                          >
                            {log.route}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{renderStatusPill(log.status, log.response_status)}</TableCell>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {log.formatted_created_at}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/admin/activity-log/${log.id}`}
                          className="text-xs font-semibold text-accent hover:underline"
                        >
                          View
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        {pagy.pages > 1 ? (
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              Showing page {pagy.page} of {pagy.pages} ({pagy.count} total records)
            </p>
            <Pagination
              pagination={{
                page: pagy.page,
                pages: pagy.pages,
              }}
              onChangePage={handlePageChange}
            />
          </div>
        ) : null}
      </div>
    </AdminLayout>
  );
}
