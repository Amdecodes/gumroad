import { CheckCircle } from "@boxicons/react";
import { router } from "@inertiajs/react";
import * as React from "react";
import { Line, XAxis, YAxis } from "recharts";

import { useTranslation, type TranslationFn } from "$app/utils/i18n";

import { AdminLayout } from "$app/components/Admin/AdminLayout";
import useChartTooltip from "$app/components/Analytics/useChartTooltip";
import { Chart, lineProps, xAxisProps, yAxisProps } from "$app/components/Chart";
import { LanguageToggle } from "$app/components/LanguageToggle";
import { Stats } from "$app/components/Stats";
import { Card, CardContent } from "$app/components/ui/Card";
import { PageHeader } from "$app/components/ui/PageHeader";
import { Pill } from "$app/components/ui/Pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$app/components/ui/Table";
import { Tab, Tabs } from "$app/components/ui/Tabs";

export type MetricRevenue = {
  cents: number;
  formatted: string;
};

export type KpiMetrics = {
  revenue: MetricRevenue;
  orders_count: number;
  creators_count: number;
  customers_count: number;
  subscriptions_count: number;
};

export type NeedsAttention = {
  creators_requiring_review: number;
  payments_pending: number;
  subscriptions_failing: number;
  disputes_open: number;
};

export type TrendPoint = {
  date: string;
  label: string;
  revenue_cents: number;
  revenue_formatted: string;
  orders_count: number;
};

export type SalesTrendData = {
  points: TrendPoint[];
  selected_range: number;
};

export type RecentOrder = {
  id: string;
  customer_email: string;
  product_name: string;
  seller_name: string;
  amount_formatted: string;
  status: string;
  created_at: string;
};

export type OverviewProps = {
  metrics: KpiMetrics;
  needs_attention: NeedsAttention;
  sales_trend: SalesTrendData;
  recent_orders: RecentOrder[];
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

const renderOrderStatusPill = (status: string, t: TranslationFn) => {
  switch (status) {
    case "successful":
      return (
        <Pill color="success" size="small">
          {t("admin.status.successful", undefined, "Successful")}
        </Pill>
      );
    case "failed":
      return (
        <Pill color="danger" size="small">
          {t("admin.status.failed", undefined, "Failed")}
        </Pill>
      );
    case "refunded":
      return (
        <Pill color="warning" size="small">
          {t("admin.status.refunded", undefined, "Refunded")}
        </Pill>
      );
    case "in_progress":
      return (
        <Pill color="primary" size="small">
          {t("admin.status.in_progress", undefined, "In progress")}
        </Pill>
      );
    case "preorder_authorization_successful":
      return (
        <Pill color="success" size="small">
          {t("admin.status.preorder", undefined, "Preorder")}
        </Pill>
      );
    default:
      return <Pill size="small">{status.replace(/_/gu, " ")}</Pill>;
  }
};

const TrendTooltip = ({ point, t }: { point: TrendPoint; t: TranslationFn }) => (
  <div className="space-y-1">
    <div className="text-xs font-bold text-muted">{point.date}</div>
    <div className="text-sm font-semibold">{point.revenue_formatted}</div>
    <div className="text-xs text-muted">
      {point.orders_count}{" "}
      {point.orders_count === 1
        ? t("admin.overview_page.trend_order", undefined, "order")
        : t("admin.overview_page.trend_orders", undefined, "orders")}
    </div>
  </div>
);

export default function Overview({ metrics, needs_attention, sales_trend, recent_orders }: OverviewProps) {
  const { t } = useTranslation();
  const selectedRange = sales_trend.selected_range;

  const handleRangeChange = (range: number) => {
    router.get(
      "/admin",
      { range },
      {
        preserveState: true,
        replace: true,
      },
    );
  };

  const chartData = React.useMemo(
    () =>
      sales_trend.points.map((pt) => ({
        ...pt,
        revenue_dollars: Math.round((pt.revenue_cents / 100) * 100) / 100,
      })),
    [sales_trend.points],
  );

  const { tooltip, containerRef, dotRef, events } = useChartTooltip();
  const tooltipPoint = tooltip != null ? chartData[tooltip.index] : null;

  const hasNeedsAttentionItems =
    needs_attention.creators_requiring_review > 0 ||
    needs_attention.payments_pending > 0 ||
    needs_attention.subscriptions_failing > 0 ||
    needs_attention.disputes_open > 0;

  return (
    <div className="space-y-8">
      <PageHeader title={t("admin.overview", undefined, "Overview")} showTitleOnMobile className="px-0 pt-0 pb-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            {t("admin.overview_page.subtitle", undefined, "Platform health, key metrics, and operational overview")}
          </p>
          <LanguageToggle />
        </div>
      </PageHeader>

      {/* KPI Cards */}
      <section aria-label="Key metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Stats
          title={t("admin.overview_page.revenue", undefined, "Revenue")}
          description={t("admin.overview_page.revenue_description", undefined, "All-time gross sales volume")}
          value={metrics.revenue.formatted}
        />
        <Stats
          title={t("admin.overview_page.orders", undefined, "Orders")}
          description={t("admin.overview_page.orders_description", undefined, "Total completed paid orders")}
          value={metrics.orders_count.toLocaleString()}
        />
        <Stats
          title={t("admin.overview_page.creators", undefined, "Creators")}
          description={t("admin.overview_page.creators_description", undefined, "Creators with active products")}
          value={metrics.creators_count.toLocaleString()}
        />
        <Stats
          title={t("admin.overview_page.customers", undefined, "Customers")}
          description={t("admin.overview_page.customers_description", undefined, "Unique paying buyers")}
          value={metrics.customers_count.toLocaleString()}
        />
        <Stats
          title={t("admin.overview_page.subscriptions", undefined, "Subscriptions")}
          description={t(
            "admin.overview_page.subscriptions_description",
            undefined,
            "Currently active recurring subscriptions",
          )}
          value={metrics.subscriptions_count.toLocaleString()}
        />
      </section>

      {/* Needs Attention */}
      <section aria-label="Needs attention" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">
              {t("admin.overview_page.needs_attention", undefined, "Needs attention")}
            </h2>
            <p className="text-xs text-muted">
              {t(
                "admin.overview_page.needs_attention_subtitle",
                undefined,
                "Operational items requiring review or resolution",
              )}
            </p>
          </div>
          {!hasNeedsAttentionItems ? (
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <CheckCircle className="size-4 text-green" />
              <span>{t("admin.overview_page.all_queues_clear", undefined, "All queues clear")}</span>
            </div>
          ) : null}
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded border border-border bg-background p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted">
                    {t("admin.overview_page.creators_review", undefined, "Creators review")}
                  </span>
                  {needs_attention.creators_requiring_review > 0 ? (
                    <Pill color="warning" size="small">
                      {t("admin.overview_page.review_badge", undefined, "Review")}
                    </Pill>
                  ) : null}
                </div>
                <div className="mt-2 text-2xl font-bold">{needs_attention.creators_requiring_review}</div>
                <div className="mt-1 text-xs text-muted">
                  {t("admin.overview_page.creators_review_detail", undefined, "Flagged for fraud or TOS")}
                </div>
              </div>

              <div className="rounded border border-border bg-background p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted">
                    {t("admin.overview_page.payments_pending", undefined, "Payments pending")}
                  </span>
                  {needs_attention.payments_pending > 0 ? (
                    <Pill color="primary" size="small">
                      {t("admin.overview_page.settling_badge", undefined, "Settling")}
                    </Pill>
                  ) : null}
                </div>
                <div className="mt-2 text-2xl font-bold">{needs_attention.payments_pending}</div>
                <div className="mt-1 text-xs text-muted">
                  {t("admin.overview_page.payments_pending_detail", undefined, "Payments currently settling")}
                </div>
              </div>

              <div className="rounded border border-border bg-background p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted">
                    {t("admin.overview_page.failing_subscriptions", undefined, "Failing subscriptions")}
                  </span>
                  {needs_attention.subscriptions_failing > 0 ? (
                    <Pill color="danger" size="small">
                      {t("admin.overview_page.action_badge", undefined, "Action")}
                    </Pill>
                  ) : null}
                </div>
                <div className="mt-2 text-2xl font-bold">{needs_attention.subscriptions_failing}</div>
                <div className="mt-1 text-xs text-muted">
                  {t("admin.overview_page.failing_subscriptions_detail", undefined, "Failed payment retries")}
                </div>
              </div>

              <div className="rounded border border-border bg-background p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted">
                    {t("admin.overview_page.open_disputes", undefined, "Open disputes")}
                  </span>
                  {needs_attention.disputes_open > 0 ? (
                    <Pill color="danger" size="small">
                      {t("admin.overview_page.urgent_badge", undefined, "Urgent")}
                    </Pill>
                  ) : null}
                </div>
                <div className="mt-2 text-2xl font-bold">{needs_attention.disputes_open}</div>
                <div className="mt-1 text-xs text-muted">
                  {t("admin.overview_page.open_disputes_detail", undefined, "Disputes requiring response")}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Sales / Revenue Trend */}
      <section aria-label="Sales trend" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold">{t("admin.overview_page.sales_trend", undefined, "Sales trend")}</h2>
            <p className="text-xs text-muted">
              {t(
                "admin.overview_page.sales_trend_subtitle",
                undefined,
                "Daily gross revenue across the selected period",
              )}
            </p>
          </div>
          <Tabs variant="pills">
            <Tab isSelected={selectedRange === 7} onClick={() => handleRangeChange(7)}>
              {t("admin.overview_page.range_7_days", undefined, "7 days")}
            </Tab>
            <Tab isSelected={selectedRange === 30} onClick={() => handleRangeChange(30)}>
              {t("admin.overview_page.range_30_days", undefined, "30 days")}
            </Tab>
            <Tab isSelected={selectedRange === 90} onClick={() => handleRangeChange(90)}>
              {t("admin.overview_page.range_90_days", undefined, "90 days")}
            </Tab>
          </Tabs>
        </div>

        <Chart
          containerRef={containerRef}
          tooltip={tooltipPoint ? <TrendTooltip point={tooltipPoint} t={t} /> : null}
          tooltipPosition={tooltip?.position ?? null}
          data={chartData}
          {...events}
        >
          <XAxis dataKey="label" {...xAxisProps} />
          <YAxis tickFormatter={(val: number) => `${val.toLocaleString()} ETB`} {...yAxisProps} />
          <Line dataKey="revenue_dollars" {...lineProps(dotRef, chartData.length)} />
        </Chart>
      </section>

      {/* Recent Orders */}
      <section aria-label="Recent orders" className="space-y-4">
        <div>
          <h2 className="text-base font-bold">{t("admin.overview_page.recent_orders", undefined, "Recent orders")}</h2>
          <p className="text-xs text-muted">
            {t("admin.overview_page.recent_orders_subtitle", undefined, "Latest purchases across the platform")}
          </p>
        </div>

        {recent_orders.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted">
              {t("admin.overview_page.no_orders_yet", undefined, "No orders have been recorded yet.")}
            </CardContent>
          </Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.table.customer", undefined, "Customer")}</TableHead>
                <TableHead>{t("admin.table.product", undefined, "Product")}</TableHead>
                <TableHead>{t("admin.table.amount", undefined, "Amount")}</TableHead>
                <TableHead>{t("admin.table.status", undefined, "Status")}</TableHead>
                <TableHead>{t("admin.table.date", undefined, "Date")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent_orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell label="Customer">
                    <div className="truncate font-medium">{order.customer_email}</div>
                  </TableCell>
                  <TableCell label="Product">
                    <div className="truncate">{order.product_name}</div>
                    <div className="truncate text-xs text-muted">
                      {t("admin.overview_page.by_seller", { name: order.seller_name }, `by ${order.seller_name}`)}
                    </div>
                  </TableCell>
                  <TableCell label="Amount">
                    <span className="font-semibold">{order.amount_formatted}</span>
                  </TableCell>
                  <TableCell label="Status">{renderOrderStatusPill(order.status, t)}</TableCell>
                  <TableCell label="Date">
                    <span className="text-xs text-muted">{formatOrderDate(order.created_at)}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}

Overview.layout = (page: React.ReactNode) => <AdminLayout>{page}</AdminLayout>;
