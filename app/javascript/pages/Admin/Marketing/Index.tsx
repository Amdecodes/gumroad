import * as React from "react";

import { AdminLayout } from "$app/components/Admin/AdminLayout";
import { Button } from "$app/components/Button";
import { Card, CardContent, CardHeader, CardTitle } from "$app/components/ui/Card";
import { PageHeader } from "$app/components/ui/PageHeader";
import { Pill } from "$app/components/ui/Pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$app/components/ui/Table";

export type MarketingMetrics = {
  total_offers_count: number;
  total_affiliates_count: number;
  total_audience_count: number;
  total_broadcasts_count: number;
  total_affiliate_volume_cents: number;
  formatted_affiliate_volume: string;
};

export type MarketingOffer = {
  id: string;
  code: string;
  seller_name: string;
  seller_id?: string | null;
  discount_formatted: string;
  uses_count: number;
  max_uses?: number | null;
  expires_at?: string | null;
  created_at: string;
};

export type MarketingAffiliate = {
  id: string;
  email: string;
  name?: string | null;
  fee_percentage: number;
  applies_to_all: boolean;
  products_count: number;
  created_at: string;
};

export type MarketingAudience = {
  id: number;
  email: string;
  seller_name: string;
  is_follower: boolean;
  is_customer: boolean;
  is_affiliate: boolean;
  created_at: string;
};

export type MarketingWorkflow = {
  id: string;
  name: string;
  seller_name: string;
  status: string;
  published_at?: string | null;
  created_at: string;
};

export type MarketingIndexProps = {
  metrics: MarketingMetrics;
  offers: MarketingOffer[];
  affiliates: MarketingAffiliate[];
  audience_samples: MarketingAudience[];
  workflows: MarketingWorkflow[];
  active_tab?: string;
};

const formatDate = (isoString?: string | null) => {
  if (!isoString) return "—";
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

export default function MarketingIndex({
  metrics,
  offers,
  affiliates,
  audience_samples,
  workflows,
  active_tab = "overview",
}: MarketingIndexProps) {
  const [tab, setTab] = React.useState<"overview" | "offers" | "affiliates" | "audience" | "workflows">(
    active_tab as any || "overview"
  );

  return (
    <AdminLayout currentPath="/admin/marketing">
      <div className="space-y-6">
        <PageHeader
          title="Marketing & Growth"
          description="Platform-wide management for discounts, affiliates, audience engagement, and creator email campaigns."
        />

        {/* KPI Metrics */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <span className="text-muted-foreground text-xs font-medium uppercase">Active Coupons / Offers</span>
              <div className="text-foreground mt-1 text-2xl font-bold">{metrics.total_offers_count.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <span className="text-muted-foreground text-xs font-medium uppercase">Registered Affiliates</span>
              <div className="text-foreground mt-1 text-2xl font-bold">{metrics.total_affiliates_count.toLocaleString()}</div>
              <div className="text-muted-foreground text-xs mt-0.5">{metrics.formatted_affiliate_volume} sales volume</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <span className="text-muted-foreground text-xs font-medium uppercase">Total Audience Reach</span>
              <div className="text-foreground mt-1 text-2xl font-bold">{metrics.total_audience_count.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <span className="text-muted-foreground text-xs font-medium uppercase">Email Broadcasts</span>
              <div className="text-foreground mt-1 text-2xl font-bold">{metrics.total_broadcasts_count.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-border">
          <nav className="flex space-x-4" aria-label="Marketing Tabs">
            {[
              { id: "overview", label: "Overview" },
              { id: "offers", label: `Discounts (${offers.length})` },
              { id: "affiliates", label: `Affiliates (${affiliates.length})` },
              { id: "audience", label: `Audience (${audience_samples.length})` },
              { id: "workflows", label: `Campaigns (${workflows.length})` },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id as any)}
                className={`border-b-2 py-3 px-2 text-sm font-medium transition-colors ${
                  tab === t.id
                    ? "border-accent text-accent font-semibold"
                    : "border-transparent text-muted-foreground hover:border-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab 1: Overview Summary */}
        {tab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-semibold">Recent Discounts & Coupons</CardTitle>
                  <Button variant="ghost" size="small" onClick={() => setTab("offers")}>
                    View All
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Creator</TableHead>
                        <TableHead>Discount</TableHead>
                        <TableHead>Uses</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {offers.slice(0, 5).map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="font-mono font-bold text-sm text-foreground">{o.code}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{o.seller_name}</TableCell>
                          <TableCell className="text-sm font-semibold">{o.discount_formatted}</TableCell>
                          <TableCell className="text-sm">{o.uses_count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-semibold">Top Affiliates</CardTitle>
                  <Button variant="ghost" size="small" onClick={() => setTab("affiliates")}>
                    View All
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Affiliate</TableHead>
                        <TableHead>Commission</TableHead>
                        <TableHead>Scope</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {affiliates.slice(0, 5).map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-sm font-medium text-foreground">{a.email}</TableCell>
                          <TableCell className="text-sm font-semibold">{a.fee_percentage}%</TableCell>
                          <TableCell className="text-xs">
                            {a.applies_to_all ? "All Products" : `${a.products_count} Products`}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Tab 2: Discounts / Offers */}
        {tab === "offers" && (
          <Card>
            <CardHeader>
              <CardTitle>Discounts & Offer Codes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {offers.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">No discount codes found.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Coupon Code</TableHead>
                      <TableHead>Creator</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Uses / Max</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {offers.map((offer) => (
                      <TableRow key={offer.id}>
                        <TableCell className="font-mono font-bold text-accent text-sm">{offer.code}</TableCell>
                        <TableCell className="text-sm text-foreground">{offer.seller_name}</TableCell>
                        <TableCell className="font-semibold text-sm">{offer.discount_formatted}</TableCell>
                        <TableCell className="text-sm">
                          {offer.uses_count} {offer.max_uses ? `/ ${offer.max_uses}` : "uses"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatDate(offer.expires_at)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatDate(offer.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tab 3: Affiliates */}
        {tab === "affiliates" && (
          <Card>
            <CardHeader>
              <CardTitle>Affiliates</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {affiliates.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">No affiliate accounts found.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Affiliate User</TableHead>
                      <TableHead>Commission Rate</TableHead>
                      <TableHead>Coverage</TableHead>
                      <TableHead>Products</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {affiliates.map((aff) => (
                      <TableRow key={aff.id}>
                        <TableCell className="font-medium text-sm text-foreground">
                          {aff.email}
                          {aff.name ? <div className="text-muted-foreground text-xs">{aff.name}</div> : null}
                        </TableCell>
                        <TableCell className="font-semibold text-sm">{aff.fee_percentage}%</TableCell>
                        <TableCell className="text-sm">
                          {aff.applies_to_all ? (
                            <Pill color="success" size="small">All Products</Pill>
                          ) : (
                            <Pill size="small">Selected Products</Pill>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{aff.products_count}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatDate(aff.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tab 4: Audience Reach */}
        {tab === "audience" && (
          <Card>
            <CardHeader>
              <CardTitle>Audience Members</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {audience_samples.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">No audience members recorded.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Audience Email</TableHead>
                      <TableHead>Creator</TableHead>
                      <TableHead>Roles / Types</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audience_samples.map((aud) => (
                      <TableRow key={aud.id}>
                        <TableCell className="font-medium text-sm text-foreground">{aud.email}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{aud.seller_name}</TableCell>
                        <TableCell className="text-sm">
                          <div className="flex gap-1.5">
                            {aud.is_customer ? <Pill color="success" size="small">Customer</Pill> : null}
                            {aud.is_follower ? <Pill color="accent" size="small">Follower</Pill> : null}
                            {aud.is_affiliate ? <Pill color="warning" size="small">Affiliate</Pill> : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatDate(aud.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tab 5: Workflows & Campaigns */}
        {tab === "workflows" && (
          <Card>
            <CardHeader>
              <CardTitle>Email Campaigns & Workflows</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {workflows.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">No email campaigns or workflows found.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign / Subject</TableHead>
                      <TableHead>Creator</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Published / Sent</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workflows.map((wf) => (
                      <TableRow key={wf.id}>
                        <TableCell className="font-semibold text-sm text-foreground">{wf.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{wf.seller_name}</TableCell>
                        <TableCell>
                          <Pill color={wf.status === "published" ? "success" : "default"} size="small">
                            {wf.status}
                          </Pill>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatDate(wf.published_at)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatDate(wf.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
