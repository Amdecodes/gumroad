import { ArrowLeft, File, LinkAlt, Store, User, X } from "@boxicons/react";
import { Link, router } from "@inertiajs/react";
import * as React from "react";

import { AdminLayout } from "$app/components/Admin/AdminLayout";
import { Button } from "$app/components/Button";
import { Card, CardContent } from "$app/components/ui/Card";
import { Pill } from "$app/components/ui/Pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$app/components/ui/Table";

export type ProductFile = {
  id: string;
  display_name: string;
  extension?: string | null;
  size?: number | null;
};

export type ProductDetail = {
  id: string;
  permalink: string;
  name: string;
  description: string;
  status: string;
  is_published: boolean;
  price_cents: number;
  price_formatted: string;
  currency: string;
  preview_url?: string | null;
  store_url?: string | null;
  created_at: string;
  is_licensed: boolean;
  files_count: number;
  variants_count: number;
  files: ProductFile[];
};

export type CreatorDetail = {
  id: string;
  name: string;
  username?: string | null;
  email: string;
  avatar_url?: string | null;
  admin_path: string;
};

export type ProductMetrics = {
  gross_sales_cents: number;
  gross_sales_formatted: string;
  units_sold: number;
  refund_count: number;
  refund_rate: number;
  customer_count: number;
};

export type AuditLogEntry = {
  id: number;
  action: string;
  actor_name: string;
  response_status: number;
  created_at: string;
  note?: string | null;
};

export type ProductShowProps = {
  product: ProductDetail;
  creator?: CreatorDetail | null;
  metrics: ProductMetrics;
  audit_history: AuditLogEntry[];
};

const formatFileSize = (bytes?: number | null) => {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i] || "B"}`;
};

const formatDate = (isoString: string) => {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
};

const renderProductStatusPill = (status: string) => {
  switch (status) {
    case "published":
      return (
        <Pill color="success" size="small">
          Published
        </Pill>
      );
    case "draft":
      return (
        <Pill color="warning" size="small">
          Draft
        </Pill>
      );
    case "unpublished":
      return (
        <Pill color="danger" size="small">
          Unpublished
        </Pill>
      );
    case "deleted":
      return <Pill size="small">Deleted</Pill>;
    case "banned":
      return (
        <Pill color="danger" size="small">
          Banned
        </Pill>
      );
    default:
      return <Pill size="small">{status}</Pill>;
  }
};

export default function Show({ product, creator, metrics, audit_history }: ProductShowProps) {
  const [modalMode, setModalMode] = React.useState<"unpublish" | "publish" | null>(null);
  const [reason, setReason] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleOpenModal = (mode: "unpublish" | "publish") => {
    setModalMode(mode);
    setReason("");
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setModalMode(null);
    setReason("");
  };

  const handleModerationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalMode || !reason.trim()) return;

    setIsSubmitting(true);
    router.post(
      `/admin/products/${product.permalink}/${modalMode}`,
      { reason: reason.trim() },
      {
        onFinish: () => {
          setIsSubmitting(false);
          setModalMode(null);
          setReason("");
        },
      },
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <Link
            href="/admin/products"
            className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="mr-1.5 size-4" />
            Back to Products
          </Link>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {product.preview_url ? (
              <img
                src={product.preview_url}
                alt={product.name}
                className="size-12 rounded border border-gray-200 object-cover"
              />
            ) : (
              <div className="flex size-12 items-center justify-center rounded bg-gray-100 text-gray-500">
                <Store className="size-6" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
                {renderProductStatusPill(product.status)}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>/{product.permalink}</span>
                {product.store_url ? (
                  <a
                    href={product.store_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center text-black hover:underline"
                  >
                    View in Store
                    <LinkAlt className="ml-1 size-3.5" />
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {product.is_published ? (
              <Button
                outline
                size="default"
                className="border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => handleOpenModal("unpublish")}
              >
                Take Down / Unpublish
              </Button>
            ) : (
              <Button size="default" onClick={() => handleOpenModal("publish")}>
                Publish Listing
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <span className="text-xs font-medium text-gray-500 uppercase">Gross Sales</span>
              <p className="mt-1 text-2xl font-bold text-gray-900">{metrics.gross_sales_formatted}</p>
              <span className="text-xs text-gray-400">All-time revenue</span>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <span className="text-xs font-medium text-gray-500 uppercase">Units Sold</span>
              <p className="mt-1 text-2xl font-bold text-gray-900">{metrics.units_sold}</p>
              <span className="text-xs text-gray-400">Paid purchases</span>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <span className="text-xs font-medium text-gray-500 uppercase">Refund Rate</span>
              <p className="mt-1 text-2xl font-bold text-gray-900">{metrics.refund_rate}%</p>
              <span className="text-xs text-gray-400">{metrics.refund_count} orders refunded</span>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <span className="text-xs font-medium text-gray-500 uppercase">Customer Count</span>
              <p className="mt-1 text-2xl font-bold text-gray-900">{metrics.customer_count}</p>
              <span className="text-xs text-gray-400">Distinct buyers</span>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardContent className="p-6">
                <h2 className="text-base font-semibold text-gray-900">Product Overview</h2>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <span className="text-xs text-gray-500">Price</span>
                    <p className="text-sm font-semibold text-gray-900">
                      {product.price_formatted} ({product.currency.toUpperCase()})
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">License Keys</span>
                    <p className="text-sm font-semibold text-gray-900">
                      {product.is_licensed ? "Enabled" : "Disabled"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Digital Files</span>
                    <p className="text-sm font-semibold text-gray-900">{product.files_count} attached</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Variants</span>
                    <p className="text-sm font-semibold text-gray-900">{product.variants_count} categories</p>
                  </div>
                </div>

                <div className="mt-4 border-t border-gray-100 pt-4">
                  <span className="text-xs text-gray-500">Description</span>
                  <div className="mt-1 text-sm whitespace-pre-wrap text-gray-700">
                    {product.description || <span className="text-gray-400 italic">No description provided.</span>}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h2 className="text-base font-semibold text-gray-900">Attached Digital Files</h2>
                {product.files.length === 0 ? (
                  <p className="mt-3 text-sm text-gray-500 italic">No digital files attached to this listing.</p>
                ) : (
                  <div className="mt-4 divide-y divide-gray-100 rounded border border-gray-200">
                    {product.files.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                          <File className="size-5 text-gray-400" />
                          <div>
                            <span className="block text-sm font-medium text-gray-900">{file.display_name}</span>
                            <span className="block text-xs text-gray-500">
                              {file.extension ? `.${file.extension.toUpperCase()}` : "File"} •{" "}
                              {formatFileSize(file.size)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h2 className="text-base font-semibold text-gray-900">Administrative Audit Trail</h2>
                {audit_history.length === 0 ? (
                  <p className="mt-3 text-sm text-gray-500 italic">
                    No administrative actions recorded for this product.
                  </p>
                ) : (
                  <Table className="mt-4">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Admin</TableHead>
                        <TableHead>Note / Reason</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {audit_history.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-mono text-xs">{entry.action}</TableCell>
                          <TableCell className="text-sm font-medium text-gray-900">{entry.actor_name}</TableCell>
                          <TableCell className="max-w-xs truncate text-xs text-gray-600">{entry.note || "—"}</TableCell>
                          <TableCell className="text-xs text-gray-500">{formatDate(entry.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <h2 className="text-base font-semibold text-gray-900">Creator Attribution</h2>
                {creator ? (
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center gap-3">
                      {creator.avatar_url ? (
                        <img
                          src={creator.avatar_url}
                          alt={creator.name}
                          className="size-10 rounded-full border border-gray-200 object-cover"
                        />
                      ) : (
                        <div className="flex size-10 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                          <User className="size-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <Link
                          href={creator.admin_path}
                          className="block truncate font-semibold text-gray-900 hover:underline"
                        >
                          {creator.name}
                        </Link>
                        {creator.username ? (
                          <span className="block truncate text-xs text-gray-500">@{creator.username}</span>
                        ) : null}
                        <span className="block truncate text-xs text-gray-500">{creator.email}</span>
                      </div>
                    </div>

                    <Link href={creator.admin_path} className="block">
                      <Button outline size="sm" className="w-full">
                        Inspect Creator Profile
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-gray-500 italic">No creator associated with this product.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {modalMode ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-lg font-bold text-gray-900">
                  {modalMode === "unpublish" ? "Unpublish & Take Down Product" : "Publish Product Listing"}
                </h3>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="size-5" />
                </button>
              </div>

              <form onSubmit={handleModerationSubmit} className="mt-4 space-y-4">
                <p className="text-sm text-gray-600">
                  {modalMode === "unpublish"
                    ? "This will remove the product from sale and mark it as unpublished by admin. Existing buyers will retain access to their purchases."
                    : "This will restore the product and make it publicly available for purchase again."}
                </p>

                <div>
                  <label htmlFor="moderation-reason" className="block text-xs font-semibold text-gray-700 uppercase">
                    Reason Note (Required)
                  </label>
                  <textarea
                    id="moderation-reason"
                    rows={3}
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter audit explanation for this moderation action..."
                    className="mt-1 block w-full rounded border border-gray-300 p-2 text-sm text-gray-900 focus:border-black focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" outline size="default" onClick={handleCloseModal} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    color={modalMode === "unpublish" ? "danger" : undefined}
                    size="default"
                    disabled={isSubmitting || !reason.trim()}
                  >
                    {isSubmitting
                      ? "Processing..."
                      : modalMode === "unpublish"
                        ? "Confirm Take Down"
                        : "Confirm Publish"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </AdminLayout>
  );
}
