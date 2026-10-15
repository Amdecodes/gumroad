import { Cart, Filter, Search, X } from "@boxicons/react";
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
import { useTranslation } from "$app/utils/i18n";

export type OrderSummary = {
  id: string;
  external_id_numeric: string;
  customer_email: string;
  product_name: string;
  seller_name: string;
  amount_formatted: string;
  status: string;
  refund_status?: string | null;
  created_at: string;
};

export type OrdersIndexProps = {
  orders: OrderSummary[];
  pagination: PaginationProps & { count: number; has_more: boolean };
  filters: {
    q?: string;
    status?: string;
    date?: string;
  };
};

const formatOrderDate = (isoString: string) => {
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

const renderOrderStatusPill = (
  status: string,
  refundStatus?: string | null,
  t?: (key: string, vars?: Record<string, any>, defaultVal?: string) => string,
) => {
  const translate = t || ((_k: string, _v?: any, d?: string) => d || "");
  if (refundStatus === "refunded") {
    return (
      <Pill color="warning" size="small">
        {translate("admin.status.refunded", undefined, "Refunded")}
      </Pill>
    );
  }
  if (refundStatus === "partially_refunded") {
    return (
      <Pill color="warning" size="small">
        {translate("admin.status.partially_refunded", undefined, "Partially Refunded")}
      </Pill>
    );
  }

  switch (status) {
    case "successful":
      return (
        <Pill color="success" size="small">
          {translate("admin.status.successful", undefined, "Successful")}
        </Pill>
      );
    case "failed":
      return (
        <Pill color="danger" size="small">
          {translate("admin.status.failed", undefined, "Failed")}
        </Pill>
      );
    case "not_charged":
      return <Pill size="small">{translate("admin.status.not_charged", undefined, "Not Charged")}</Pill>;
    default:
      return <Pill size="small">{status}</Pill>;
  }
};

export default function Index({ orders, pagination, filters }: OrdersIndexProps) {
  const { t } = useTranslation();
  const [query, setQuery] = React.useState(filters.q || "");
  const [status, setStatus] = React.useState(filters.status || "");
  const [date, setDate] = React.useState(filters.date || "");

  const hasActiveFilters = Boolean(filters.q || filters.status || filters.date);

  const applyFilters = (newParams: { q?: string; status?: string; date?: string; page?: number }) => {
    const params: Record<string, string | number> = {};

    const qVal = newParams.q !== undefined ? newParams.q : query;
    const statusVal = newParams.status !== undefined ? newParams.status : status;
    const dateVal = newParams.date !== undefined ? newParams.date : date;
    const pageVal = newParams.page !== undefined ? newParams.page : 1;

    if (qVal.trim()) params.q = qVal.trim();
    if (statusVal.trim()) params.status = statusVal.trim();
    if (dateVal.trim()) params.date = dateVal.trim();
    if (pageVal > 1) params.page = pageVal;

    router.get("/admin/orders", params, {
      preserveState: true,
      replace: true,
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

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setDate(newDate);
    applyFilters({ date: newDate, page: 1 });
  };

  const handleClearFilters = () => {
    setQuery("");
    setStatus("");
    setDate("");
    router.get(
      "/admin/orders",
      {},
      {
        preserveState: true,
        replace: true,
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.orders", undefined, "Orders")} showTitleOnMobile className="px-0 pt-0 pb-6">
        <p className="text-sm text-muted">
          {t("admin.orders_page.subtitle", undefined, "Search, inspect, and manage purchases across ArifDrop")}
        </p>
      </PageHeader>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <form onSubmit={handleSearchSubmit} className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Input
                type="text"
                placeholder={t(
                  "admin.orders_page.search_placeholder",
                  undefined,
                  "Search by customer email, ID, or query...",
                )}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pr-10"
              />
              <button
                type="submit"
                aria-label="Submit search"
                className="absolute top-1/2 right-3 -translate-y-1/2 text-muted hover:text-foreground"
              >
                <Search className="size-5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="size-4 shrink-0 text-muted" />
                <select
                  value={status}
                  onChange={handleStatusChange}
                  aria-label={t("admin.orders_page.filter_by_status", undefined, "Filter by status")}
                  className="h-10 rounded border border-border bg-background px-3 text-sm text-foreground"
                >
                  <option value="">{t("admin.status.all_statuses", undefined, "All statuses")}</option>
                  <option value="successful">{t("admin.status.successful", undefined, "Successful")}</option>
                  <option value="failed">{t("admin.status.failed", undefined, "Failed")}</option>
                  <option value="not_charged">{t("admin.status.not_charged", undefined, "Not charged")}</option>
                  <option value="refunded">{t("admin.status.refunded", undefined, "Refunded")}</option>
                  <option value="chargeback">{t("admin.status.chargeback", undefined, "Chargeback")}</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={date}
                  onChange={handleDateChange}
                  aria-label={t("admin.orders_page.filter_by_date", undefined, "Filter by date")}
                  className="h-10 text-sm"
                />
              </div>

              {hasActiveFilters ? (
                <Button
                  type="button"
                  outline
                  size="sm"
                  onClick={handleClearFilters}
                  className="flex items-center gap-1.5"
                >
                  <X className="size-4" />
                  <span>{t("admin.orders_page.clear", undefined, "Clear")}</span>
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Orders Table */}
      {orders.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 p-12 text-center">
            <div className="flex justify-center text-muted">
              <Cart className="size-12 stroke-1" />
            </div>
            <div className="text-base font-semibold">
              {t("admin.orders_page.empty_title", undefined, "No orders found")}
            </div>
            <p className="text-sm text-muted">
              {hasActiveFilters
                ? t(
                    "admin.orders_page.empty_filtered",
                    undefined,
                    "Try adjusting your search criteria or clearing active filters.",
                  )
                : t(
                    "admin.orders_page.empty_unfiltered",
                    undefined,
                    "No orders have been recorded in the platform yet.",
                  )}
            </p>
            {hasActiveFilters ? (
              <div className="pt-2">
                <Button outline size="sm" onClick={handleClearFilters}>
                  {t("admin.orders_page.clear_all_filters", undefined, "Clear all filters")}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.table.customer", undefined, "Customer")}</TableHead>
                  <TableHead>{t("admin.table.product", undefined, "Product")}</TableHead>
                  <TableHead>{t("admin.table.creator", undefined, "Creator")}</TableHead>
                  <TableHead>{t("admin.table.amount", undefined, "Amount")}</TableHead>
                  <TableHead>{t("admin.table.status", undefined, "Status")}</TableHead>
                  <TableHead>{t("admin.table.date", undefined, "Date")}</TableHead>
                  <TableHead className="text-right">{t("admin.table.action", undefined, "Action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell label="Customer">
                      <div className="truncate font-medium">{order.customer_email}</div>
                    </TableCell>
                    <TableCell label="Product">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="truncate font-medium underline-offset-2 hover:underline"
                      >
                        {order.product_name}
                      </Link>
                    </TableCell>
                    <TableCell label="Creator">
                      <div className="truncate text-muted">{order.seller_name}</div>
                    </TableCell>
                    <TableCell label="Amount">
                      <div className="font-medium">{order.amount_formatted}</div>
                    </TableCell>
                    <TableCell label="Status">{renderOrderStatusPill(order.status, order.refund_status, t)}</TableCell>
                    <TableCell label="Date">
                      <div className="text-xs whitespace-nowrap text-muted">{formatOrderDate(order.created_at)}</div>
                    </TableCell>
                    <TableCell label="Action" className="text-right">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
                      >
                        {t("admin.orders_page.view", undefined, "View")}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {pagination.pages > 1 ? (
            <div className="pt-4">
              <Pagination
                pagination={{ page: pagination.page, pages: pagination.pages }}
                onChangePage={(newPage) => applyFilters({ page: newPage })}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

Index.layout = (page: React.ReactNode) => <AdminLayout>{page}</AdminLayout>;
