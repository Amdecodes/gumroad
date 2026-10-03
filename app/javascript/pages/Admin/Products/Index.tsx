import { Filter, Search, Store, X } from "@boxicons/react";
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

export type ProductSummary = {
  id: string;
  permalink: string;
  name: string;
  thumbnail_url?: string | null;
  price_cents: number;
  price_formatted: string;
  sales_count: number;
  lifetime_revenue_formatted: string;
  status: string;
  created_at: string;
  creator?: {
    id: string;
    name: string;
    username?: string | null;
    email: string;
    admin_path: string;
  } | null;
};

export type ProductsIndexProps = {
  products: ProductSummary[];
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
    status?: string;
    creator_id?: string;
  };
};

const formatDate = (isoString: string) => {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
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

export default function Index({ products, pagy, filters }: ProductsIndexProps) {
  const [searchTerm, setSearchTerm] = React.useState(filters.q || "");
  const [selectedStatus, setSelectedStatus] = React.useState(filters.status || "all");

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.get(
      "/admin/products",
      {
        q: searchTerm.trim() || undefined,
        status: selectedStatus !== "all" ? selectedStatus : undefined,
        creator_id: filters.creator_id || undefined,
        page: 1,
      },
      { preserveState: true },
    );
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedStatus("all");
    router.get("/admin/products", {}, { preserveState: true });
  };

  const hasActiveFilters = Boolean(filters.q || (filters.status && filters.status !== "all") || filters.creator_id);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader title="Products Management">
          <p className="text-muted-foreground text-sm">
            Inspect and moderate listings across all creators on the platform.
          </p>
        </PageHeader>

        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleFilterSubmit} className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search product title, permalink, or creator..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                  aria-label="Search products"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-black focus:outline-none"
                  aria-label="Filter by status"
                >
                  <option value="all">All Statuses</option>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                  <option value="unpublished">Unpublished</option>
                  <option value="deleted">Deleted</option>
                </select>

                <Button type="submit" size="default">
                  <Filter className="mr-1.5 size-4" />
                  Filter
                </Button>

                {hasActiveFilters ? (
                  <Button type="button" outline size="default" onClick={handleClearFilters}>
                    <X className="mr-1 size-4" />
                    Clear
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {products.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                  <Store className="size-6" />
                </div>
                <h3 className="mt-3 text-base font-semibold text-gray-900">No products found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {hasActiveFilters
                    ? "Try adjusting your search query or status filter."
                    : "No products exist on the platform yet."}
                </p>
                {hasActiveFilters ? (
                  <Button outline size="sm" className="mt-4" onClick={handleClearFilters}>
                    Clear Filters
                  </Button>
                ) : null}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Creator</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Sales</TableHead>
                    <TableHead>Gross Volume</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          {product.thumbnail_url ? (
                            <img
                              src={product.thumbnail_url}
                              alt={product.name}
                              className="size-9 rounded border border-gray-200 object-cover"
                            />
                          ) : (
                            <div className="flex size-9 items-center justify-center rounded bg-gray-100 text-gray-500">
                              <Store className="size-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <Link
                              href={`/admin/products/${product.permalink}`}
                              className="block truncate font-semibold text-gray-900 hover:underline"
                            >
                              {product.name}
                            </Link>
                            <span className="block truncate text-xs text-gray-500">/{product.permalink}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {product.creator ? (
                          <div className="min-w-0">
                            <Link
                              href={product.creator.admin_path}
                              className="block truncate font-medium text-gray-900 hover:underline"
                            >
                              {product.creator.name}
                            </Link>
                            {product.creator.username ? (
                              <span className="block truncate text-xs text-gray-500">@{product.creator.username}</span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Unknown</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-gray-900">{product.price_formatted}</TableCell>
                      <TableCell className="text-sm text-gray-600">{product.sales_count}</TableCell>
                      <TableCell className="text-sm font-medium text-gray-900">
                        {product.lifetime_revenue_formatted}
                      </TableCell>
                      <TableCell>{renderProductStatusPill(product.status)}</TableCell>
                      <TableCell className="text-sm text-gray-500">{formatDate(product.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Link href={`/admin/products/${product.permalink}`}>
                          <Button outline size="sm">
                            Inspect
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {pagy.pages > 1 && (
          <div className="flex justify-center">
            <Pagination
              pagination={{ page: pagy.page, pages: pagy.pages }}
              onChangePage={(page: number) =>
                router.get(
                  "/admin/products",
                  {
                    q: filters.q,
                    status: filters.status,
                    creator_id: filters.creator_id,
                    page,
                  },
                  { preserveState: true },
                )
              }
            />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
