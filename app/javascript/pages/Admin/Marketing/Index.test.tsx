// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Index, {
  type MarketingAffiliate,
  type MarketingAudience,
  type MarketingIndexProps,
  type MarketingMetrics,
  type MarketingOffer,
  type MarketingWorkflow,
} from "./Index";

vi.mock("@inertiajs/react", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@inertiajs/react")>();
  return {
    ...mod,
    router: {
      get: vi.fn(),
      post: vi.fn(),
    },
    usePage: () => ({ url: "/admin/marketing", props: {} }),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockMetrics: MarketingMetrics = {
  total_offers_count: 14,
  total_affiliates_count: 5,
  total_audience_count: 120,
  total_broadcasts_count: 8,
  total_affiliate_volume_cents: 250000,
  formatted_affiliate_volume: "2,500.00 ETB",
};

const mockOffers: MarketingOffer[] = [
  {
    id: "offer_1",
    code: "LAUNCH50",
    seller_name: "Abebe Creator",
    seller_id: "seller_1",
    discount_formatted: "50% off",
    uses_count: 12,
    max_uses: 100,
    expires_at: null,
    created_at: "2026-10-01T12:00:00Z",
  },
];

const mockAffiliates: MarketingAffiliate[] = [
  {
    id: "aff_1",
    email: "partner@example.com",
    name: "Partner Abebe",
    fee_percentage: 20,
    applies_to_all: true,
    products_count: 3,
    created_at: "2026-09-15T12:00:00Z",
  },
];

const mockAudience: MarketingAudience[] = [
  {
    id: 1,
    email: "fan@example.com",
    seller_name: "Abebe Creator",
    is_follower: true,
    is_customer: true,
    is_affiliate: false,
    created_at: "2026-10-02T10:00:00Z",
  },
];

const mockWorkflows: MarketingWorkflow[] = [
  {
    id: "wf_1",
    name: "Welcome Newsletter",
    seller_name: "Abebe Creator",
    status: "published",
    published_at: "2026-10-03T10:00:00Z",
    created_at: "2026-10-03T09:00:00Z",
  },
];

const defaultProps: MarketingIndexProps = {
  metrics: mockMetrics,
  offers: mockOffers,
  affiliates: mockAffiliates,
  audience_samples: mockAudience,
  workflows: mockWorkflows,
  active_tab: "overview",
};

describe("Admin Marketing Index Page", () => {
  it("renders overview metrics and recent discounts", () => {
    render(<Index {...defaultProps} />);

    expect(screen.getByText("Marketing & Growth")).toBeDefined();
    expect(screen.getByText("Active Coupons / Offers")).toBeDefined();
    expect(screen.getByText("14")).toBeDefined();
    expect(screen.getByText("2,500.00 ETB sales volume")).toBeDefined();
    expect(screen.getByText("LAUNCH50")).toBeDefined();
    expect(screen.getByText("50% off")).toBeDefined();
    expect(screen.getByText("partner@example.com")).toBeDefined();
  });

  it("switches to Discounts tab when clicked", () => {
    render(<Index {...defaultProps} />);

    const discountsTabButton = screen.getByRole("button", { name: "Discounts (1)" });
    fireEvent.click(discountsTabButton);

    expect(screen.getByText("Discounts & Offer Codes")).toBeDefined();
    expect(screen.getByText("LAUNCH50")).toBeDefined();
    expect(screen.getByText("Abebe Creator")).toBeDefined();
  });

  it("switches to Affiliates tab when clicked", () => {
    render(<Index {...defaultProps} />);

    const affiliatesTabButton = screen.getByRole("button", { name: "Affiliates (1)" });
    fireEvent.click(affiliatesTabButton);

    expect(screen.getByRole("heading", { name: "Affiliates" })).toBeDefined();
    expect(screen.getByText("partner@example.com")).toBeDefined();
    expect(screen.getByText("20%")).toBeDefined();
    expect(screen.getByText("All Products")).toBeDefined();
  });

  it("switches to Audience tab when clicked", () => {
    render(<Index {...defaultProps} />);

    const audienceTabButton = screen.getByRole("button", { name: "Audience (1)" });
    fireEvent.click(audienceTabButton);

    expect(screen.getByText("Audience Members")).toBeDefined();
    expect(screen.getByText("fan@example.com")).toBeDefined();
    expect(screen.getByText("Customer")).toBeDefined();
    expect(screen.getByText("Follower")).toBeDefined();
  });

  it("switches to Campaigns tab when clicked", () => {
    render(<Index {...defaultProps} />);

    const campaignsTabButton = screen.getByRole("button", { name: "Campaigns (1)" });
    fireEvent.click(campaignsTabButton);

    expect(screen.getByText("Email Campaigns & Workflows")).toBeDefined();
    expect(screen.getByText("Welcome Newsletter")).toBeDefined();
  });

  it("renders empty state messages when lists are empty", () => {
    render(<Index {...defaultProps} offers={[]} affiliates={[]} audience_samples={[]} workflows={[]} />);

    const discountsTab = screen.getByRole("button", { name: "Discounts (0)" });
    fireEvent.click(discountsTab);
    expect(screen.getByText("No discount codes found.")).toBeDefined();

    const affiliatesTab = screen.getByRole("button", { name: "Affiliates (0)" });
    fireEvent.click(affiliatesTab);
    expect(screen.getByText("No affiliate accounts found.")).toBeDefined();
  });
});
