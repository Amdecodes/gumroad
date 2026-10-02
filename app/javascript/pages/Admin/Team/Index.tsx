import { Search, Shield, User, UserX, X } from "@boxicons/react";
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

export type TeamMemberSummary = {
  id: string;
  username: string;
  name: string;
  email: string;
  avatar_url?: string;
  is_root_account: boolean;
  is_current_user: boolean;
  role_label: string;
  joined_at: string;
  formatted_joined_at: string;
  actions_count: number;
  last_active_at?: string | null;
  formatted_last_active_at: string;
  can_revoke: boolean;
};

export type TeamIndexProps = {
  team_members: TeamMemberSummary[];
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
  };
  current_admin?: {
    name: string;
    email: string;
  };
};

export default function TeamIndex({ team_members, pagy, filters }: TeamIndexProps) {
  const [searchQuery, setSearchQuery] = React.useState(filters.q || "");
  const [revokingMember, setRevokingMember] = React.useState<TeamMemberSummary | null>(null);
  const [revokeReason, setRevokeReason] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const applySearch = (query: string) => {
    router.get("/admin/team", { q: query.trim() || undefined }, { preserveState: true, preserveScroll: true });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applySearch(searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    router.get("/admin/team", {}, { preserveState: true });
  };

  const handlePageChange = (nextPage: number) => {
    router.get(
      "/admin/team",
      { q: searchQuery.trim() || undefined, page: nextPage.toString() },
      { preserveState: true },
    );
  };

  const handleConfirmRevoke = () => {
    if (!revokingMember) return;
    setIsSubmitting(true);

    router.post(
      `/admin/team/${revokingMember.id}/revoke`,
      { reason: revokeReason },
      {
        onFinish: () => {
          setIsSubmitting(false);
          setRevokingMember(null);
          setRevokeReason("");
        },
      },
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader title="Team Management">
          <p className="text-muted-foreground text-sm">
            Manage staff members and platform administrators with access to ArifDrop Admin.
          </p>
        </PageHeader>

        {/* Search Toolbar */}
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-[240px] flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Search staff by name, email, or username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  aria-label="Search staff members"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button type="submit" color="primary">
                  Search
                </Button>
                {searchQuery ? (
                  <Button type="button" onClick={handleClearSearch}>
                    <X className="mr-1.5 size-4" />
                    Clear
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Staff Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Actions Logged</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {team_members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Shield className="text-muted-foreground size-8" />
                        <p className="text-muted-foreground text-sm font-medium">No team members found.</p>
                        {searchQuery ? (
                          <Button size="sm" onClick={handleClearSearch}>
                            Clear search
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  team_members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {member.avatar_url ? (
                            <img
                              src={member.avatar_url}
                              alt={member.name}
                              className="size-9 rounded-full border border-border object-cover"
                            />
                          ) : (
                            <div className="text-muted-foreground flex size-9 items-center justify-center rounded-full bg-muted">
                              <User className="size-5" />
                            </div>
                          )}
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                              <span>{member.name}</span>
                              {member.is_current_user ? (
                                <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                                  You
                                </span>
                              ) : null}
                            </div>
                            <div className="text-muted-foreground text-xs">{member.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Pill color={member.is_root_account ? "primary" : undefined} size="small">
                          {member.role_label}
                        </Pill>
                      </TableCell>
                      <TableCell className="text-sm font-medium text-foreground">
                        {member.actions_count.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{member.formatted_last_active_at}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{member.formatted_joined_at}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/team/${member.id}`}
                            className="text-xs font-semibold text-accent hover:underline"
                          >
                            View
                          </Link>
                          {member.can_revoke ? (
                            <button
                              type="button"
                              onClick={() => setRevokingMember(member)}
                              className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline dark:text-rose-400"
                            >
                              Revoke
                            </button>
                          ) : null}
                        </div>
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
              Showing page {pagy.page} of {pagy.pages} ({pagy.count} total staff)
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

        {/* Revoke Confirmation Dialog */}
        {revokingMember ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-labelledby="revoke-modal-title"
          >
            <div className="bg-card w-full max-w-md space-y-4 rounded-lg border border-border p-6 shadow-xl">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-rose-500/10 p-2 text-rose-600 dark:text-rose-400">
                  <UserX className="size-6" />
                </div>
                <div className="space-y-1">
                  <h3 id="revoke-modal-title" className="text-lg font-semibold text-foreground">
                    Revoke Staff Access
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Are you sure you want to revoke administrative access for{" "}
                    <strong className="text-foreground">{revokingMember.name}</strong> ({revokingMember.email})?
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="revoke-reason" className="text-xs font-medium text-foreground">
                  Reason for revocation (optional):
                </label>
                <Input
                  id="revoke-reason"
                  type="text"
                  placeholder="e.g., Staff departure, role adjustment..."
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  onClick={() => {
                    setRevokingMember(null);
                    setRevokeReason("");
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="button" color="danger" onClick={handleConfirmRevoke} disabled={isSubmitting}>
                  {isSubmitting ? "Revoking..." : "Confirm Revocation"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AdminLayout>
  );
}
