import { ArrowLeft, History, Lock, Shield, User, UserCheck, UserX } from "@boxicons/react";
import { Link, router } from "@inertiajs/react";
import * as React from "react";

import { AdminLayout } from "$app/components/Admin/AdminLayout";
import { Button } from "$app/components/Button";
import { Card, CardContent } from "$app/components/ui/Card";
import { Input } from "$app/components/ui/Input";
import { PageHeader } from "$app/components/ui/PageHeader";
import { Pill } from "$app/components/ui/Pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$app/components/ui/Table";

export type MemberAuditAction = {
  id: string;
  action: string;
  humanized_action: string;
  target_type?: string | null;
  target_external_id?: string | null;
  target_link?: string | null;
  route: string;
  response_status?: number | null;
  status: "success" | "failure";
  created_at: string;
  formatted_created_at: string;
};

export type TeamMemberShowProps = {
  member: {
    id: string;
    username: string;
    name: string;
    email: string;
    avatar_url?: string;
    bio?: string;
    is_root_account: boolean;
    is_current_user: boolean;
    role_label: string;
    joined_at: string;
    formatted_joined_at: string;
    two_factor_enabled: boolean;
    confirmed: boolean;
    can_revoke: boolean;
  };
  stats: {
    actions_count: number;
    first_action_at?: string | null;
    latest_action_at?: string | null;
    formatted_latest_action_at: string;
  };
  recent_actions: MemberAuditAction[];
  impersonate_url: string;
  current_admin?: {
    name: string;
    email: string;
  };
};

export default function TeamMemberShow({ member, stats, recent_actions, impersonate_url }: TeamMemberShowProps) {
  const [showRevokeModal, setShowRevokeModal] = React.useState(false);
  const [revokeReason, setRevokeReason] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleConfirmRevoke = () => {
    setIsSubmitting(true);
    router.post(
      `/admin/team/${member.id}/revoke`,
      { reason: revokeReason },
      {
        onFinish: () => {
          setIsSubmitting(false);
          setShowRevokeModal(false);
          setRevokeReason("");
        },
      },
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/team">
            <Button size="sm">
              <ArrowLeft className="mr-1.5 size-4" />
              Back to Team
            </Button>
          </Link>
        </div>

        <PageHeader
          title={member.name}
          actions={
            <div className="flex items-center gap-2">
              <a href={impersonate_url}>
                <Button size="sm">
                  <UserCheck className="mr-1.5 size-4" />
                  Impersonate
                </Button>
              </a>
              {member.can_revoke ? (
                <Button color="danger" size="sm" onClick={() => setShowRevokeModal(true)}>
                  <UserX className="mr-1.5 size-4" />
                  Revoke Access
                </Button>
              ) : null}
            </div>
          }
        >
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <span>{member.email}</span>
            <span>•</span>
            <span className="font-mono text-xs">@{member.username}</span>
            {member.is_current_user ? (
              <>
                <span>•</span>
                <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                  Current Session
                </span>
              </>
            ) : null}
          </div>
        </PageHeader>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  Role & Status
                </span>
                <Shield className="text-muted-foreground size-4" />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Pill color={member.is_root_account ? "primary" : "success"} size="small">
                  {member.role_label}
                </Pill>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  Admin Actions
                </span>
                <History className="text-muted-foreground size-4" />
              </div>
              <div className="mt-2 text-2xl font-bold text-foreground">{stats.actions_count.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  2FA Authentication
                </span>
                <Lock className="text-muted-foreground size-4" />
              </div>
              <div className="mt-2 flex items-center gap-2">
                {member.two_factor_enabled ? (
                  <Pill color="success" size="small">
                    Enabled
                  </Pill>
                ) : (
                  <Pill color="warning" size="small">
                    Disabled
                  </Pill>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">Last Active</span>
                <UserCheck className="text-muted-foreground size-4" />
              </div>
              <div
                className="mt-2 truncate text-sm font-semibold text-foreground"
                title={stats.formatted_latest_action_at}
              >
                {stats.formatted_latest_action_at}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profile Card */}
        <Card>
          <div className="border-b border-border p-4">
            <h2 className="text-base font-semibold text-foreground">Staff Profile</h2>
          </div>
          <CardContent details className="p-4">
            <div className="flex flex-col gap-6 md:flex-row md:items-center">
              {member.avatar_url ? (
                <img
                  src={member.avatar_url}
                  alt={member.name}
                  className="size-20 rounded-full border border-border object-cover"
                />
              ) : (
                <div className="text-muted-foreground flex size-20 items-center justify-center rounded-full bg-muted">
                  <User className="size-10" />
                </div>
              )}

              <div className="grid flex-1 gap-4 text-sm sm:grid-cols-2 md:grid-cols-3">
                <div>
                  <span className="text-muted-foreground text-xs">Display Name</span>
                  <p className="font-medium text-foreground">{member.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Email Address</span>
                  <p className="font-mono text-xs text-foreground">{member.email}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">External ID</span>
                  <p className="font-mono text-xs text-foreground">{member.id}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Joined Date</span>
                  <p className="text-foreground">{member.formatted_joined_at}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Email Verification</span>
                  <p className="text-foreground">{member.confirmed ? "Confirmed" : "Unconfirmed"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Account Privilege</span>
                  <p className="font-semibold text-foreground">{member.role_label}</p>
                </div>
              </div>
            </div>
            {member.bio ? (
              <div className="mt-4 border-t border-border pt-4">
                <span className="text-muted-foreground text-xs">Bio / Notes</span>
                <p className="mt-1 text-sm text-foreground">{member.bio}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Recent Activity Table */}
        <Card>
          <div className="flex items-center justify-between border-b border-border p-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Recent Administrative Activity</h2>
              <p className="text-muted-foreground mt-0.5 text-xs">Audit events executed by {member.name}.</p>
            </div>
            <Link href={`/admin/activity-log?actor=${member.id}`}>
              <Button size="sm">View Full History</Button>
            </Link>
          </div>
          <CardContent details className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent_actions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground h-24 text-center text-sm">
                      No administrative actions recorded for this team member yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  recent_actions.map((act) => (
                    <TableRow key={act.id}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <span className="text-sm font-semibold text-foreground">{act.humanized_action}</span>
                          <div className="text-muted-foreground font-mono text-xs">{act.action}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {act.target_type ? (
                          <div className="space-y-0.5">
                            <span className="text-muted-foreground text-[10px] uppercase">{act.target_type}</span>
                            {act.target_link ? (
                              <div>
                                <Link href={act.target_link} className="font-mono text-xs text-accent hover:underline">
                                  {act.target_external_id}
                                </Link>
                              </div>
                            ) : (
                              <div className="font-mono text-xs text-foreground">{act.target_external_id || "—"}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{act.route}</TableCell>
                      <TableCell>
                        <Pill color={act.status === "success" ? "success" : "danger"} size="small">
                          {act.response_status || act.status}
                        </Pill>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right text-xs whitespace-nowrap">
                        {act.formatted_created_at}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Revoke Confirmation Dialog */}
        {showRevokeModal ? (
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
                    <strong className="text-foreground">{member.name}</strong> ({member.email})?
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="revoke-reason-show" className="text-xs font-medium text-foreground">
                  Reason for revocation (optional):
                </label>
                <Input
                  id="revoke-reason-show"
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
                    setShowRevokeModal(false);
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
