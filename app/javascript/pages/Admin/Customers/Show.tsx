import { ArchiveArrowDown, ArrowLeft, Key, Package } from "@boxicons/react";
import { Link } from "@inertiajs/react";
import * as React from "react";

import { AdminLayout } from "$app/components/Admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "$app/components/ui/Card";
import { PageHeader } from "$app/components/ui/PageHeader";
import { Pill } from "$app/components/ui/Pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$app/components/ui/Table";

export type CustomerDetail = {
  id: string;
  email: string;
  name?: string | null;
  user_id?: string | null;
  is_registered: boolean;
  registered_at?: string | null;
  orders_count: number;
  total_spent_cents: number;
  total_spent_formatted: string;
  active_subscriptions_count: number;
  refunds_count: number;
};

export type CustomerPurchase = {
  id: string;
  external_id_numeric?: string;
  product_name: string;
  seller_name: string;
  amount_formatted: string;
  status: string;
  refund_status?: string | null;
  created_at: string;
  download_url?: string | null;
  receipt_url: string;
  license_serial?: string | null;
  is_physical: boolean;
};

export type CustomerSubscription = {
  id: string;
  product_name: string;
  seller_name: string;
  amount_formatted: string;
  frequency: string;
  status: string;
  created_at: string;
  current_period_end?: string | null;
};

export type CustomerRefund = {
  id: number;
  order_id?: string;
  product_name: string;
  seller_name: string;
  amount_formatted: string;
  reason?: string | null;
  created_at: string;
};

export type CustomersShowProps = {
  customer: CustomerDetail;
  purchases: CustomerPurchase[];
  subscriptions: CustomerSubscription[];
  refunds: CustomerRefund[];
};

const formatDate = (isoString?: string | null) => {
  if (!isoString) return "—";
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

export default function CustomersShow({ customer, purchases, subscriptions, refunds }: CustomersShowProps) {
  return (
    <AdminLayout currentPath="/admin/customers">
      <div className="space-y-6">
        <div>
          <Link
            href="/admin/customers"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to Customers
          </Link>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <PageHeader
            title={customer.email}
            description={
              customer.is_registered
                ? `Registered user account (User ID: ${customer.user_id || "—"})`
                : "Guest buyer account"
            }
          />
          <div>
            {customer.is_registered ? (
              <Pill color="success">Registered Account</Pill>
            ) : (
              <Pill>Guest Buyer</Pill>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <span className="text-muted-foreground text-xs font-medium uppercase">Total Spent</span>
              <div className="text-foreground mt-1 text-2xl font-bold">{customer.total_spent_formatted}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <span className="text-muted-foreground text-xs font-medium uppercase">Orders Placed</span>
              <div className="text-foreground mt-1 text-2xl font-bold">{customer.orders_count}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <span className="text-muted-foreground text-xs font-medium uppercase">Active Subscriptions</span>
              <div className="text-foreground mt-1 text-2xl font-bold">{customer.active_subscriptions_count}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <span className="text-muted-foreground text-xs font-medium uppercase">Refunds</span>
              <div className="text-foreground mt-1 text-2xl font-bold">{customer.refunds_count}</div>
            </CardContent>
          </Card>
        </div>

        {/* Purchases / Orders */}
        <Card>
          <CardHeader>
            <CardTitle>Order History & Product Deliveries</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {purchases.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                No orders found for this customer.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Creator</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Fulfillment / Access</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs">
                        <Link href={`/admin/orders/${order.id}`} className="text-accent hover:underline">
                          {order.id}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {order.product_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{order.seller_name}</TableCell>
                      <TableCell className="font-semibold text-sm">{order.amount_formatted}</TableCell>
                      <TableCell>
                        <Pill
                          color={
                            order.refund_status === "refunded"
                              ? "warning"
                              : order.status === "successful"
                                ? "success"
                                : "danger"
                          }
                          size="small"
                        >
                          {order.refund_status || order.status}
                        </Pill>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-col gap-1">
                          {order.download_url ? (
                            <a
                              href={order.download_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-accent hover:underline inline-flex items-center gap-1"
                            >
                              <ArchiveArrowDown className="size-3.5" />
                              Download File
                            </a>
                          ) : null}
                          {order.license_serial ? (
                            <span className="font-mono text-muted-foreground inline-flex items-center gap-1">
                              <Key className="size-3.5 text-accent" />
                              {order.license_serial}
                            </span>
                          ) : null}
                          {order.is_physical ? (
                            <span className="text-muted-foreground inline-flex items-center gap-1">
                              <Package className="size-3.5" />
                              Physical shipment
                            </span>
                          ) : null}
                          {!order.download_url && !order.license_serial && !order.is_physical ? (
                            <span className="text-muted-foreground">Standard access</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatDate(order.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Subscriptions */}
        {subscriptions.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Subscriptions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subscription ID</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Creator</TableHead>
                    <TableHead>Price & Recurrence</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Period End</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-mono text-xs">
                        <Link href={`/admin/subscriptions/${sub.id}`} className="text-accent hover:underline">
                          {sub.id}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{sub.product_name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{sub.seller_name}</TableCell>
                      <TableCell className="font-semibold text-sm">
                        {sub.amount_formatted} / {sub.frequency}
                      </TableCell>
                      <TableCell>
                        <Pill
                          color={
                            sub.status === "active"
                              ? "success"
                              : sub.status === "failing"
                                ? "warning"
                                : "danger"
                          }
                          size="small"
                        >
                          {sub.status}
                        </Pill>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(sub.current_period_end)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}

        {/* Refunds */}
        {refunds.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Refund Records</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order Ref</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Creator</TableHead>
                    <TableHead>Refund Amount</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {refunds.map((refund) => (
                    <TableRow key={refund.id}>
                      <TableCell className="font-mono text-xs">
                        {refund.order_id ? (
                          <Link href={`/admin/orders/${refund.order_id}`} className="text-accent hover:underline">
                            {refund.order_id}
                          </Link>
                        ) : (
                          `#${refund.id}`
                        )}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{refund.product_name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{refund.seller_name}</TableCell>
                      <TableCell className="text-warning font-semibold text-sm">
                        -{refund.amount_formatted}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{refund.reason || "Standard refund"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatDate(refund.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AdminLayout>
  );
}
