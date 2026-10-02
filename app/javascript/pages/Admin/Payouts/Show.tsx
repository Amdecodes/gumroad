import { ArrowLeft, CheckCircle, User, XCircle } from "@boxicons/react";
import { Link, router } from "@inertiajs/react";
import * as React from "react";

import { AdminLayout } from "$app/components/Admin/AdminLayout";
import { Button } from "$app/components/Button";
import { Modal } from "$app/components/Modal";
import { Card, CardContent } from "$app/components/ui/Card";
import { Input } from "$app/components/ui/Input";
import { PageHeader } from "$app/components/ui/PageHeader";
import { Pill } from "$app/components/ui/Pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$app/components/ui/Table";
import { Textarea } from "$app/components/ui/Textarea";

export type PayoutDetailProps = {
  payout: {
    external_id: string;
    reference: string;
    amount_cents: number;
    formatted_amount: string;
    currency: string;
    status: string;
    date_requested: string;
    date_processed?: string | null;
    processor: string;
    can_mark_paid: boolean;
    can_cancel: boolean;
  };
  creator?: {
    external_id: string;
    name: string;
    username: string;
    email: string;
    avatar_url?: string;
    admin_path: string;
  } | null;
  destination: {
    method_type: string;
    processor: string;
    bank_name?: string | null;
    account_number_visual?: string | null;
    routing_number?: string | null;
    account_holder_name?: string | null;
    account_type?: string | null;
    paypal_email?: string | null;
  };
  breakdown: {
    sales_volume_cents: number;
    formatted_sales_volume: string;
    platform_fee_cents: number;
    formatted_platform_fee: string;
    processor_fee_cents: number;
    formatted_processor_fee: string;
    adjustments_cents: number;
    formatted_adjustments: string;
    net_amount_cents: number;
    formatted_net_amount: string;
  };
  audit_history: {
    id: number;
    action: string;
    actor_name: string;
    actor_email?: string | null;
    created_at: string;
    response_status: number;
    note?: string | null;
  }[];
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
      hour: "numeric",
      minute: "2-digit",
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

export default function Show({ payout, creator, destination, breakdown, audit_history }: PayoutDetailProps) {
  const [isMarkPaidModalOpen, setIsMarkPaidModalOpen] = React.useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = React.useState(false);

  const [paymentNote, setPaymentNote] = React.useState("");
  const [cancelReason, setCancelReason] = React.useState("");

  const [isSubmittingMarkPaid, setIsSubmittingMarkPaid] = React.useState(false);
  const [isSubmittingCancel, setIsSubmittingCancel] = React.useState(false);

  const handleMarkPaidSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingMarkPaid(true);

    router.post(
      `/admin/payouts/${payout.external_id}/mark_paid`,
      { note: paymentNote.trim() },
      {
        onFinish: () => {
          setIsSubmittingMarkPaid(false);
          setIsMarkPaidModalOpen(false);
          setPaymentNote("");
        },
      },
    );
  };

  const handleCancelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReason.trim()) return;

    setIsSubmittingCancel(true);
    router.post(
      `/admin/payouts/${payout.external_id}/cancel`,
      { reason: cancelReason.trim() },
      {
        onFinish: () => {
          setIsSubmittingCancel(false);
          setIsCancelModalOpen(false);
          setCancelReason("");
        },
      },
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2">
          <Link
            href="/admin/payouts"
            className="flex items-center gap-1.5 text-sm font-medium text-muted no-underline hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            <span>Back to payouts</span>
          </Link>
        </div>

        {/* Hero Header */}
        <PageHeader
          title={`Payout #${payout.reference}`}
          actions={
            <div className="flex items-center gap-3">
              {renderPayoutStatusPill(payout.status)}

              {payout.can_mark_paid ? (
                <Button
                  type="button"
                  color="primary"
                  onClick={() => setIsMarkPaidModalOpen(true)}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <CheckCircle className="mr-1.5 size-4" />
                  Mark as Paid
                </Button>
              ) : null}

              {payout.can_cancel ? (
                <Button type="button" color="danger" outline onClick={() => setIsCancelModalOpen(true)}>
                  <XCircle className="mr-1.5 size-4" />
                  Cancel / Hold
                </Button>
              ) : null}
            </div>
          }
        >
          {creator ? (
            <p className="text-muted-foreground text-sm">
              Recipient:{" "}
              <Link href={creator.admin_path} className="font-semibold text-foreground no-underline hover:underline">
                {creator.name} (@{creator.username || "creator"})
              </Link>
            </p>
          ) : null}
        </PageHeader>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column (2 cols): Overview & Breakdown, Destination, and Audit History */}
          <div className="space-y-6 lg:col-span-2">
            {/* Overview & Financial Breakdown Card */}
            <Card>
              <div className="border-b border-border p-4 text-base font-semibold">Financial Breakdown</div>
              <CardContent className="space-y-6 p-6">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div>
                    <div className="text-xs text-muted">Net Payout Amount</div>
                    <div className="text-2xl font-bold text-foreground">{payout.formatted_amount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Payment Processor</div>
                    <div className="text-base font-medium text-foreground">{payout.processor}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Requested Date</div>
                    <div className="text-sm font-medium text-foreground">{formatDate(payout.date_requested)}</div>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/5 p-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted">Included Sales Volume</span>
                      <span className="font-medium text-foreground">{breakdown.formatted_sales_volume}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Platform Fee Deductions</span>
                      <span className="font-medium text-muted">-{breakdown.formatted_platform_fee}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Processor Fee Deductions</span>
                      <span className="font-medium text-muted">-{breakdown.formatted_processor_fee}</span>
                    </div>
                    {breakdown.adjustments_cents !== 0 ? (
                      <div className="flex justify-between">
                        <span className="text-muted">Adjustments / Credits</span>
                        <span className="font-medium text-foreground">{breakdown.formatted_adjustments}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                      <span>Total Net Disbursement</span>
                      <span className="text-foreground">{breakdown.formatted_net_amount}</span>
                    </div>
                  </div>
                </div>

                {payout.date_processed ? (
                  <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="size-4 shrink-0" />
                    <span>Processed and confirmed on {formatDate(payout.date_processed)}.</span>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* Destination Account Information */}
            <Card>
              <div className="border-b border-border p-4 text-base font-semibold">Destination Account Information</div>
              <CardContent className="space-y-4 p-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted">Transfer Method</div>
                    <div className="text-sm font-semibold tracking-wide text-foreground uppercase">
                      {destination.method_type} ({destination.processor})
                    </div>
                  </div>

                  {destination.bank_name ? (
                    <div>
                      <div className="text-xs text-muted">Bank Name</div>
                      <div className="text-sm font-medium text-foreground">{destination.bank_name}</div>
                    </div>
                  ) : null}

                  {destination.account_number_visual ? (
                    <div>
                      <div className="text-xs text-muted">Account Number</div>
                      <div className="font-mono text-sm font-medium text-foreground">
                        {destination.account_number_visual}
                      </div>
                    </div>
                  ) : null}

                  {destination.routing_number ? (
                    <div>
                      <div className="text-xs text-muted">Routing / Bank Number</div>
                      <div className="font-mono text-sm font-medium text-foreground">{destination.routing_number}</div>
                    </div>
                  ) : null}

                  {destination.account_holder_name ? (
                    <div>
                      <div className="text-xs text-muted">Account Holder Name</div>
                      <div className="text-sm font-medium text-foreground">{destination.account_holder_name}</div>
                    </div>
                  ) : null}

                  {destination.paypal_email ? (
                    <div>
                      <div className="text-xs text-muted">PayPal Account Email</div>
                      <div className="text-sm font-medium text-foreground">{destination.paypal_email}</div>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {/* Audit Log & Status History */}
            <Card>
              <div className="border-b border-border p-4 text-base font-semibold">Audit History & Admin Activity</div>
              <CardContent className="p-0">
                {audit_history.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted">
                    No administrative audit actions recorded for this payout.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Admin Actor</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Note / Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {audit_history.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="text-xs whitespace-nowrap text-muted">
                              {formatDate(entry.created_at)}
                            </TableCell>
                            <TableCell className="text-xs font-medium text-foreground">{entry.actor_name}</TableCell>
                            <TableCell className="font-mono text-xs text-foreground">{entry.action}</TableCell>
                            <TableCell className="text-xs text-muted">{entry.note || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column (1 col): Creator Details */}
          <div className="space-y-6">
            <Card>
              <div className="border-b border-border p-4 text-base font-semibold">Creator Profile</div>
              <CardContent className="space-y-4 p-6">
                {creator ? (
                  <>
                    <div className="flex items-center gap-3">
                      {creator.avatar_url ? (
                        <img
                          src={creator.avatar_url}
                          alt={creator.name}
                          className="size-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex size-12 items-center justify-center rounded-full bg-accent/10 text-accent">
                          <User className="size-6" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-base font-bold text-foreground">{creator.name}</div>
                        <div className="truncate text-xs text-muted">@{creator.username || "creator"}</div>
                      </div>
                    </div>

                    <div className="space-y-2 border-t border-border pt-3 text-sm">
                      <div>
                        <div className="text-xs text-muted">Email</div>
                        <div className="font-medium text-foreground">{creator.email}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted">Creator ID</div>
                        <div className="font-mono text-xs text-muted">{creator.external_id}</div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <Button type="button" outline className="w-full" onClick={() => router.visit(creator.admin_path)}>
                        View Creator Management
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted">No creator profile linked to this record.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Modal: Mark as Paid */}
        <Modal
          open={isMarkPaidModalOpen}
          onClose={() => setIsMarkPaidModalOpen(false)}
          title="Approve & Mark Payout as Paid"
          footer={
            <div className="flex w-full justify-end gap-3">
              <Button
                type="button"
                outline
                disabled={isSubmittingMarkPaid}
                onClick={() => setIsMarkPaidModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                color="primary"
                disabled={isSubmittingMarkPaid}
                onClick={handleMarkPaidSubmit}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {isSubmittingMarkPaid ? "Executing..." : "Confirm & Release Payout"}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-muted">
              You are about to approve and execute this payout of{" "}
              <strong className="text-foreground">{payout.formatted_amount}</strong> to{" "}
              <strong className="text-foreground">{creator?.name || "the creator"}</strong>.
            </p>

            <div className="space-y-1 rounded border border-border bg-muted/5 p-3 text-xs">
              <div>
                <strong>Destination:</strong> {destination.method_type} ({destination.processor})
              </div>
              {destination.account_number_visual ? (
                <div>
                  <strong>Account:</strong> {destination.account_number_visual}
                </div>
              ) : null}
              {destination.paypal_email ? (
                <div>
                  <strong>PayPal Email:</strong> {destination.paypal_email}
                </div>
              ) : null}
            </div>

            <div className="space-y-1">
              <label htmlFor="payout-note" className="text-xs font-semibold text-foreground">
                Administrative Reference / Note (Optional)
              </label>
              <Input
                id="payout-note"
                type="text"
                placeholder="e.g. Bank wire reference #12345 or approval note"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
              />
            </div>
          </div>
        </Modal>

        {/* Modal: Cancel / Hold */}
        <Modal
          open={isCancelModalOpen}
          onClose={() => setIsCancelModalOpen(false)}
          title="Cancel Payout"
          footer={
            <div className="flex w-full justify-end gap-3">
              <Button type="button" outline disabled={isSubmittingCancel} onClick={() => setIsCancelModalOpen(false)}>
                Keep Payout
              </Button>
              <Button
                type="button"
                color="danger"
                disabled={isSubmittingCancel || !cancelReason.trim()}
                onClick={handleCancelSubmit}
              >
                {isSubmittingCancel ? "Cancelling..." : "Confirm Cancellation"}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Are you sure you want to cancel this pending payout of{" "}
              <strong className="text-foreground">{payout.formatted_amount}</strong>? Cancelled payouts will not be
              disbursed, and associated balances will be returned to the creator’s unpaid balance.
            </p>

            <div className="space-y-1">
              <label htmlFor="cancel-reason" className="text-xs font-semibold text-foreground">
                Cancellation Reason (Mandatory)
              </label>
              <Textarea
                id="cancel-reason"
                rows={3}
                placeholder="Please state the administrative reason for cancelling or holding this payout..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                required
              />
              <p className="text-[11px] text-muted">
                This explanation will be recorded in the administrative audit history.
              </p>
            </div>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
}
