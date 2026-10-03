import { CreditCard, Store, TrendingUp, User } from "@boxicons/react";
import { Link, router } from "@inertiajs/react";
import * as React from "react";

import { AdminLayout } from "$app/components/Admin/AdminLayout";
import { Card, CardContent } from "$app/components/ui/Card";
import { PageHeader } from "$app/components/ui/PageHeader";

export type TrendPoint = {
  date: string;
  label: string;
  revenue_cents: number;
  formatted_revenue: string;
  orders_count: number;
};

export type TopProduct = {
  id: string;
  permalink: string;
  name: string;
  volume_cents: number;
  formatted_volume: string;
  sales_count: number;
  creator_name: string;
};

export type TopCreator = {
  id: string;
  name: string;
  username?: string | null;
  volume_cents: number;
  formatted_volume: string;
  sales_count: number;
  admin_path: string;
};

export type PaymentMethodStat = {
  name: string;
  orders_count: number;
  volume_cents: number;
  formatted_volume: string;
  percentage: number;
};

export type PlatformMetrics = {
  gross_volume_cents: number;
  formatted_gross_volume: string;
  total_orders: number;
  average_order_value_cents: number;
  formatted_average_order_value: string;
  refund_rate: number;
  refunded_count: number;
  dispute_rate: number;
  dispute_count: number;
};

export type ReportsIndexProps = {
  metrics: PlatformMetrics;
  trend: {
    points: TrendPoint[];
    range: number;
  };
  top_products: TopProduct[];
  top_creators: TopCreator[];
  payment_methods: PaymentMethodStat[];
  selected_range: number;
};

const RANGES = [7, 30, 90];

export default function Index({
  metrics,
  trend,
  top_products,
  top_creators,
  payment_methods,
  selected_range,
}: ReportsIndexProps) {
  const handleRangeChange = (range: number) => {
    router.get("/admin/reports", { range }, { preserveState: true });
  };

  const maxDailyRevenue = Math.max(...trend.points.map((p) => p.revenue_cents), 1);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <PageHeader title="Reports & Platform Health">
            <p className="text-muted-foreground text-sm">
              Platform volume trends, refund rates, top creators, and payment methods.
            </p>
          </PageHeader>

          <div className="flex items-center rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleRangeChange(r)}
                className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selected_range === r ? "bg-black text-white" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {r} Days
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <span className="text-xs font-medium text-gray-500 uppercase">Gross Volume</span>
              <p className="mt-1 text-2xl font-bold text-gray-900">{metrics.formatted_gross_volume}</p>
              <span className="text-xs text-gray-400">All-time platform volume</span>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <span className="text-xs font-medium text-gray-500 uppercase">Total Orders</span>
              <p className="mt-1 text-2xl font-bold text-gray-900">{metrics.total_orders}</p>
              <span className="text-xs text-gray-400">Paid purchases</span>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <span className="text-xs font-medium text-gray-500 uppercase">Average Order Value</span>
              <p className="mt-1 text-2xl font-bold text-gray-900">{metrics.formatted_average_order_value}</p>
              <span className="text-xs text-gray-400">Volume per order</span>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <span className="text-xs font-medium text-gray-500 uppercase">Global Refund Rate</span>
              <p className="mt-1 text-2xl font-bold text-gray-900">{metrics.refund_rate}%</p>
              <span className="text-xs text-gray-400">
                {metrics.refunded_count} total refunds ({metrics.dispute_count} disputes)
              </span>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="size-5 text-gray-700" />
                <h2 className="text-base font-semibold text-gray-900">Volume Velocity Trend ({selected_range} Days)</h2>
              </div>
              <span className="text-xs text-gray-500">{trend.points.length} daily data points</span>
            </div>

            <div className="mt-6 space-y-3">
              {trend.points.map((pt) => {
                const barWidth = Math.max(Math.round((pt.revenue_cents / maxDailyRevenue) * 100), 2);
                return (
                  <div key={pt.date} className="flex items-center gap-4 text-xs">
                    <span className="w-16 shrink-0 font-mono text-gray-500">{pt.label}</span>
                    <div className="flex-1">
                      <div className="h-4 w-full overflow-hidden rounded bg-gray-100">
                        <div className="h-full rounded bg-black" style={{ width: `${barWidth}%` }} />
                      </div>
                    </div>
                    <span className="w-24 shrink-0 text-right font-medium text-gray-900">{pt.formatted_revenue}</span>
                    <span className="w-16 shrink-0 text-right text-gray-500">{pt.orders_count} orders</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <Store className="size-5 text-gray-700" />
                <h3 className="text-base font-semibold text-gray-900">Top Products by Volume</h3>
              </div>

              {top_products.length === 0 ? (
                <p className="mt-4 text-sm text-gray-500 italic">No product sales recorded yet.</p>
              ) : (
                <div className="mt-4 divide-y divide-gray-100">
                  {top_products.map((product) => (
                    <div key={product.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={`/admin/products/${product.permalink}`}
                            className="block truncate text-sm font-semibold text-gray-900 hover:underline"
                          >
                            {product.name}
                          </Link>
                          <span className="block truncate text-xs text-gray-500">by {product.creator_name}</span>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="block text-sm font-bold text-gray-900">{product.formatted_volume}</span>
                          <span className="block text-xs text-gray-500">{product.sales_count} sales</span>
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
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <User className="size-5 text-gray-700" />
                <h3 className="text-base font-semibold text-gray-900">Top Creators by Volume</h3>
              </div>

              {top_creators.length === 0 ? (
                <p className="mt-4 text-sm text-gray-500 italic">No creator sales recorded yet.</p>
              ) : (
                <div className="mt-4 divide-y divide-gray-100">
                  {top_creators.map((creator) => (
                    <div key={creator.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={creator.admin_path}
                            className="block truncate text-sm font-semibold text-gray-900 hover:underline"
                          >
                            {creator.name}
                          </Link>
                          {creator.username ? (
                            <span className="block truncate text-xs text-gray-500">@{creator.username}</span>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="block text-sm font-bold text-gray-900">{creator.formatted_volume}</span>
                          <span className="block text-xs text-gray-500">{creator.sales_count} sales</span>
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
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <CreditCard className="size-5 text-gray-700" />
                <h3 className="text-base font-semibold text-gray-900">Payment Processor Distribution</h3>
              </div>

              {payment_methods.length === 0 ? (
                <p className="mt-4 text-sm text-gray-500 italic">No transactions processed yet.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {payment_methods.map((method) => (
                    <div key={method.name} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-gray-900">{method.name}</span>
                        <span className="text-gray-500">
                          {method.percentage}% ({method.orders_count} orders)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-black"
                          style={{ width: `${Math.max(method.percentage, 2)}%` }}
                        />
                      </div>
                      <div className="text-right text-[11px] text-gray-400">{method.formatted_volume}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
