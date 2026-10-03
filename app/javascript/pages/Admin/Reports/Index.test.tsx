// @vitest-environment happy-dom
import { router } from "@inertiajs/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
});

import Index, { ReportsIndexProps } from "./Index";

vi.mock("@inertiajs/react", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@inertiajs/react");
  return {
    ...actual,
    router: {
      get: vi.fn(),
    },
    usePage: () => ({
      url: "/admin/reports",
      props: {},
    }),
    Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
      <a href={href} className={className}>
        {children}
      </a>
    ),
  };
});

const defaultProps: ReportsIndexProps = {
  metrics: {
    gross_volume_cents: 12500000,
    formatted_gross_volume: "$125,000.00",
    total_orders: 2500,
    average_order_value_cents: 5000,
    formatted_average_order_value: "$50.00",
    refund_rate: 1.8,
    refunded_count: 45,
    dispute_rate: 0.2,
    dispute_count: 5,
  },
  trend: {
    points: [
      {
        date: "2026-09-01",
        label: "Sep 1",
        revenue_cents: 50000,
        formatted_revenue: "$500.00",
        orders_count: 10,
      },
      {
        date: "2026-09-02",
        label: "Sep 2",
        revenue_cents: 75000,
        formatted_revenue: "$750.00",
        orders_count: 15,
      },
    ],
    range: 30,
  },
  top_products: [
    {
      id: "prod_1",
      permalink: "flagship-guide",
      name: "Flagship Guide",
      volume_cents: 4500000,
      formatted_volume: "$45,000.00",
      sales_count: 900,
      creator_name: "Alice Designer",
    },
  ],
  top_creators: [
    {
      id: "usr_alice",
      name: "Alice Designer",
      username: "alice",
      volume_cents: 6000000,
      formatted_volume: "$60,000.00",
      sales_count: 1200,
      admin_path: "/admin/creators/alice",
    },
  ],
  payment_methods: [
    {
      name: "Stripe",
      orders_count: 2000,
      volume_cents: 10000000,
      formatted_volume: "$100,000.00",
      percentage: 80.0,
    },
    {
      name: "Paypal",
      orders_count: 500,
      volume_cents: 2500000,
      formatted_volume: "$25,000.00",
      percentage: 20.0,
    },
  ],
  selected_range: 30,
};

describe("Admin Reports Index Page", () => {
  it("renders platform health metrics, trends, and breakdown cards", () => {
    render(<Index {...defaultProps} />);

    expect(screen.getByRole("heading", { name: /Reports & Platform Health/iu })).toBeDefined();
    expect(screen.getByText("$125,000.00")).toBeDefined();
    expect(screen.getByText("2500")).toBeDefined();
    expect(screen.getByText("$50.00")).toBeDefined();
    expect(screen.getByText("1.8%")).toBeDefined();

    expect(screen.getByText("Flagship Guide")).toBeDefined();
    expect(screen.getByText("$45,000.00")).toBeDefined();
    expect(screen.getByText("Alice Designer")).toBeDefined();

    expect(screen.getByText("Stripe")).toBeDefined();
    expect(screen.getByText("Paypal")).toBeDefined();
  });

  it("handles time range selection changes", () => {
    render(<Index {...defaultProps} />);

    const range7Btn = screen.getByRole("button", { name: /7 Days/iu });
    fireEvent.click(range7Btn);

    expect(router.get).toHaveBeenCalledWith("/admin/reports", expect.objectContaining({ range: 7 }), expect.anything());
  });
});
