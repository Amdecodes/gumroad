import { ArrowLeft, CheckCircle, XCircle } from "@boxicons/react";
import { Link } from "@inertiajs/react";
import * as React from "react";

import { AdminLayout } from "$app/components/Admin/AdminLayout";
import { Button } from "$app/components/Button";
import { Card, CardContent } from "$app/components/ui/Card";
import { PageHeader } from "$app/components/ui/PageHeader";
import { Pill } from "$app/components/ui/Pill";

export type ActivityLogDetailProps = {
  log: {
    id: string;
    action: string;
    humanized_action: string;
    actor: {
      id?: string;
      name: string;
      email?: string;
    };
    target_type?: string | null;
    target_id?: string | null;
    target_external_id?: string | null;
    target_link?: string | null;
    route: string;
    http_method: string;
    response_status?: number | null;
    status: "success" | "failure";
    error_class?: string | null;
    request_id?: string | null;
    params_snapshot?: Record<string, unknown>;
    token?: {
      external_id?: string;
      scope?: string;
    };
    created_at: string;
    formatted_created_at: string;
  };
  current_admin?: {
    name: string;
    email: string;
  };
};

export default function ActivityLogShow({ log }: ActivityLogDetailProps) {
  const isSuccess = log.status === "success";

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/activity-log">
            <Button size="sm">
              <ArrowLeft className="mr-1.5 size-4" />
              Back to Activity Log
            </Button>
          </Link>
        </div>

        <PageHeader
          title={`Activity Log #${log.id}`}
          actions={
            log.target_link ? (
              <Link href={log.target_link}>
                <Button color="primary" size="sm">
                  View Target {log.target_type}
                </Button>
              </Link>
            ) : undefined
          }
        >
          <p className="text-muted-foreground text-sm">
            Detailed inspection of administrative audit entry and API payload snapshot.
          </p>
        </PageHeader>

        {/* Action Status Banner */}
        <Card className={isSuccess ? "border-emerald-500/20 bg-emerald-500/5" : "border-rose-500/20 bg-rose-500/5"}>
          <CardContent className="flex items-center gap-3 p-4">
            {isSuccess ? (
              <CheckCircle className="size-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <XCircle className="size-5 text-rose-600 dark:text-rose-400" />
            )}
            <div className="flex-1">
              <span className="text-sm font-semibold text-foreground">{log.humanized_action}</span>
              <span className="text-muted-foreground ml-2 text-xs">({log.action})</span>
            </div>
            <Pill color={isSuccess ? "success" : "danger"} size="small">
              {log.response_status ? `${log.response_status} ` : ""}
              {isSuccess ? "Success" : "Failed"}
            </Pill>
          </CardContent>
        </Card>

        {/* Metadata Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Execution Details */}
          <Card>
            <div className="border-b border-border p-4">
              <h2 className="text-base font-semibold text-foreground">Execution Details</h2>
            </div>
            <CardContent details className="divide-y divide-border p-4 text-sm">
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">HTTP Route</span>
                <span className="font-mono text-xs font-semibold text-foreground">
                  <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px]">{log.http_method}</span>
                  {log.route}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Timestamp</span>
                <span className="font-medium text-foreground">{log.formatted_created_at}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Response Code</span>
                <span className="font-mono text-xs text-foreground">{log.response_status || "—"}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Request ID</span>
                <span className="max-w-[200px] truncate font-mono text-xs text-foreground" title={log.request_id || ""}>
                  {log.request_id || "—"}
                </span>
              </div>
              {log.error_class ? (
                <div className="flex justify-between py-2">
                  <span className="font-medium text-rose-600 dark:text-rose-400">Error Class</span>
                  <span className="font-mono text-xs text-rose-600 dark:text-rose-400">{log.error_class}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Actor & Target Context */}
          <Card>
            <div className="border-b border-border p-4">
              <h2 className="text-base font-semibold text-foreground">Actor & Target</h2>
            </div>
            <CardContent details className="divide-y divide-border p-4 text-sm">
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Actor Name</span>
                <span className="font-medium text-foreground">{log.actor.name}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Actor Email</span>
                <span className="font-mono text-xs text-foreground">{log.actor.email || "—"}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Target Type</span>
                <span className="font-medium text-foreground">{log.target_type || "None"}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Target Reference</span>
                {log.target_link ? (
                  <Link href={log.target_link} className="font-mono text-xs text-accent hover:underline">
                    {log.target_external_id || log.target_id || "—"}
                  </Link>
                ) : (
                  <span className="font-mono text-xs text-foreground">
                    {log.target_external_id || log.target_id || "—"}
                  </span>
                )}
              </div>
              {log.token?.scope ? (
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Token Scope</span>
                  <span className="text-muted-foreground font-mono text-xs">{log.token.scope}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* Parameters Snapshot */}
        <Card>
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="text-base font-semibold text-foreground">Parameters Snapshot</h2>
            <span className="text-muted-foreground text-xs">Passphrases and sensitive values are redacted</span>
          </div>
          <CardContent details className="p-4">
            {log.params_snapshot && Object.keys(log.params_snapshot).length > 0 ? (
              <pre className="overflow-x-auto rounded-md bg-muted/60 p-4 font-mono text-xs text-foreground">
                {JSON.stringify(log.params_snapshot, null, 2)}
              </pre>
            ) : (
              <p className="text-muted-foreground text-xs italic">No additional request parameters recorded.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
