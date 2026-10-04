import { CheckCircle } from "@boxicons/react";
import { router } from "@inertiajs/react";
import * as React from "react";
import { Line, XAxis, YAxis } from "recharts";

import { AdminLayout } from "$app/components/Admin/AdminLayout";
import useChartTooltip from "$app/components/Analytics/useChartTooltip";
import { Chart, lineProps, xAxisProps, yAxisProps } from "$app/components/Chart";
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

const renderOrderStatusPill = (status: string) => {
  switch (status) {
    case "successful":
      return (
        <Pill color="success" size="small">
          Successful
        </Pill>
      );
    case "failed":
      return (
        <Pill color="danger" size="small">
          Failed
        </Pill>
      );
    case "refunded":
      return (
        <Pill color="warning" size="small">
          Refunded
        </Pill>
      );
    case "in_progress":
      return (
        <Pill color="primary" size="small">
          In progress
        </Pill>
      );
    case "preorder_authorization_successful":
      return (
        <Pill color="success" size="small">
          Preorder
        </Pill>
      );
    default:
      return <Pill size="small">{status.replace(/_/gu, " ")}</Pill>;
  }
};

const TrendTooltip = ({ point }: { point: TrendPoint }) => (
  <div className="space-y-1">
    <div className="text-xs font-bold text-muted">{point.date}</div>
    <div className="text-sm font-semibold">{point.revenue_formatted}</div>
    <div className="text-xs text-muted">
      {point.orders_count} {point.orders_count === 1 ? "order" : "orders"}
    </div>
  </div>
);

export default function Overview({ metrics, needs_attention, sales_trend, recent_orders }: OverviewProps) {
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
      <PageHeader title="Overview" showTitleOnMobile className="px-0 pt-0 pb-6">
        <p className="text-sm text-muted">Platform health, key metrics, and operational overview</p>
      </PageHeader>

      {/* KPI Cards */}
      <section aria-label="Key metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Stats title="Revenue" description="All-time gross sales volume" value={metrics.revenue.formatted} />
        <Stats title="Orders" description="Total completed paid orders" value={metrics.orders_count.toLocaleString()} />
        <Stats
          title="Creators"
          description="Creators with active products"
          value={metrics.creators_count.toLocaleString()}
        />
        <Stats title="Customers" description="Unique paying buyers" value={metrics.customers_count.toLocaleString()} />
        <Stats
          title="Subscriptions"
          description="Currently active recurring subscriptions"
          value={metrics.subscriptions_count.toLocaleString()}
        />
      </section>

      {/* Needs Attention */}
      <section aria-label="Needs attention" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">Needs attention</h2>
            <p className="text-xs text-muted">Operational items requiring review or resolution</p>
          </div>
          {!hasNeedsAttentionItems ? (
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <CheckCircle className="size-4 text-green" />
              <span>All queues clear</span>
            </div>
          ) : null}
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded border border-border bg-background p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted">Creators review</span>
                  {needs_attention.creators_requiring_review > 0 ? (
                    <Pill color="warning" size="small">
                      Review
                    </Pill>
                  ) : null}
                </div>
                <div className="mt-2 text-2xl font-bold">{needs_attention.creators_requiring_review}</div>
                <div className="mt-1 text-xs text-muted">Flagged for fraud or TOS</div>
              </div>

              <div className="rounded border border-border bg-background p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted">Payments pending</span>
                  {needs_attention.payments_pending > 0 ? (
                    <Pill color="primary" size="small">
                      Settling
                    </Pill>
                  ) : null}
                </div>
                <div className="mt-2 text-2xl font-bold">{needs_attention.payments_pending}</div>
                <div className="mt-1 text-xs text-muted">Payments currently settling</div>
              </div>

              <div className="rounded border border-border bg-background p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted">Failing subscriptions</span>
                  {needs_attention.subscriptions_failing > 0 ? (
                    <Pill color="danger" size="small">
                      Action
                    </Pill>
                  ) : null}
                </div>
                <div className="mt-2 text-2xl font-bold">{needs_attention.subscriptions_failing}</div>
                <div className="mt-1 text-xs text-muted">Failed payment retries</div>
              </div>

              <div className="rounded border border-border bg-background p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted">Open disputes</span>
                  {needs_attention.disputes_open > 0 ? (
                    <Pill color="danger" size="small">
                      Urgent
                    </Pill>
                  ) : null}
                </div>
                <div className="mt-2 text-2xl font-bold">{needs_attention.disputes_open}</div>
                <div className="mt-1 text-xs text-muted">Disputes requiring response</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Sales / Revenue Trend */}
      <section aria-label="Sales trend" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold">Sales trend</h2>
            <p className="text-xs text-muted">Daily gross revenue across the selected period</p>
          </div>
          <Tabs variant="pills">
            <Tab isSelected={selectedRange === 7} onClick={() => handleRangeChange(7)}>
              7 days
            </Tab>
            <Tab isSelected={selectedRange === 30} onClick={() => handleRangeChange(30)}>
              30 days
            </Tab>
            <Tab isSelected={selectedRange === 90} onClick={() => handleRangeChange(90)}>
              90 days
            </Tab>
          </Tabs>
        </div>

        <Chart
          containerRef={containerRef}
          tooltip={tooltipPoint ? <TrendTooltip point={tooltipPoint} /> : null}
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
          <h2 className="text-base font-bold">Recent orders</h2>
          <p className="text-xs text-muted">Latest purchases across the platform</p>
        </div>

        {recent_orders.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted">No orders have been recorded yet.</CardContent>
          </Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
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
                    <div className="truncate text-xs text-muted">by {order.seller_name}</div>
                  </TableCell>
                  <TableCell label="Amount">
                    <span className="font-semibold">{order.amount_formatted}</span>
                  </TableCell>
                  <TableCell label="Status">{renderOrderStatusPill(order.status)}</TableCell>
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
