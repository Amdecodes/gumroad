// @vitest-environment happy-dom
import { router } from "@inertiajs/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Overview, { type OverviewProps } from "./Overview";

vi.mock("@inertiajs/react", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@inertiajs/react")>();
  return {
    ...mod,
    router: {
      get: vi.fn(),
    },
  };
});

vi.mock("$app/components/Stats", () => ({
  Stats: ({ title, value, description }: { title: React.ReactNode; value?: string; description?: string }) => (
    <div data-testid="stats-card">
      <div>{title}</div>
      <div>{value}</div>
      {description ? <div>{description}</div> : null}
    </div>
  ),
}));

const containerWidth = 800;
vi.mock("recharts", async (importOriginal) => {
  const recharts = await importOriginal<typeof import("recharts")>();
  const ResponsiveContainer = React.forwardRef(({ children }: { children: React.ReactElement }, _ref) => (
    <div style={{ width: containerWidth, height: 400 }}>
      {React.cloneElement(children, { width: containerWidth, height: 400 })}
    </div>
  ));
  ResponsiveContainer.displayName = "ResponsiveContainer";
  return { ...recharts, ResponsiveContainer };
});

afterEach(cleanup);

const mockProps: OverviewProps = {
  metrics: {
    revenue: { cents: 250000, formatted: "$2,500" },
    orders_count: 42,
    creators_count: 8,
    customers_count: 35,
    subscriptions_count: 14,
  },
  needs_attention: {
    creators_requiring_review: 2,
    payments_pending: 1,
    subscriptions_failing: 3,
    disputes_open: 1,
  },
  sales_trend: {
    selected_range: 30,
    points: [
      { date: "2026-09-01", label: "Sep 1", revenue_cents: 10000, revenue_formatted: "$100", orders_count: 2 },
      { date: "2026-09-02", label: "Sep 2", revenue_cents: 15000, revenue_formatted: "$150", orders_count: 3 },
    ],
  },
  recent_orders: [
    {
      id: "1001",
      customer_email: "buyer@example.com",
      product_name: "Test E-Book",
      seller_name: "Author Name",
      amount_formatted: "$10.00",
      status: "successful",
      created_at: "2026-09-02T12:00:00Z",
    },
    {
      id: "1002",
      customer_email: "second@example.com",
      product_name: "Coffee Support",
      seller_name: "Barista",
      amount_formatted: "$5.00",
      status: "in_progress",
      created_at: "2026-09-02T13:00:00Z",
    },
  ],
};

describe("Overview Page", () => {
  it("renders page title and subtitle", () => {
    render(<Overview {...mockProps} />);

    expect(screen.getByRole("heading", { name: "Overview" })).toBeDefined();
    expect(screen.getByText("Platform health, key metrics, and operational overview")).toBeDefined();
  });

  it("renders all five KPI metric cards", () => {
    render(<Overview {...mockProps} />);

    expect(screen.getByText("Revenue")).toBeDefined();
    expect(screen.getByText("$2,500")).toBeDefined();

    expect(screen.getByText("Orders")).toBeDefined();
    expect(screen.getByText("42")).toBeDefined();

    expect(screen.getByText("Creators")).toBeDefined();
    expect(screen.getByText("8")).toBeDefined();

    expect(screen.getByText("Customers")).toBeDefined();
    expect(screen.getByText("35")).toBeDefined();

    expect(screen.getByText("Subscriptions")).toBeDefined();
    expect(screen.getByText("14")).toBeDefined();
  });

  it("renders needs attention section with counts and status pills", () => {
    render(<Overview {...mockProps} />);

    expect(screen.getByText("Needs attention")).toBeDefined();
    expect(screen.getByText("Creators review")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
    expect(screen.getByText("Review")).toBeDefined();

    expect(screen.getByText("Payments pending")).toBeDefined();
    expect(screen.getAllByText("1").length).toBe(2);
    expect(screen.getByText("Settling")).toBeDefined();

    expect(screen.getByText("Failing subscriptions")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText("Action")).toBeDefined();

    expect(screen.getByText("Open disputes")).toBeDefined();
    expect(screen.getByText("Urgent")).toBeDefined();
  });

  it("renders all queues clear message when all needs attention counts are 0", () => {
    const clearProps: OverviewProps = {
      ...mockProps,
      needs_attention: {
        creators_requiring_review: 0,
        payments_pending: 0,
        subscriptions_failing: 0,
        disputes_open: 0,
      },
    };

    render(<Overview {...clearProps} />);

    expect(screen.getByText("All queues clear")).toBeDefined();
  });

  it("renders recent orders table with customer, product, and status", () => {
    render(<Overview {...mockProps} />);

    expect(screen.getByText("buyer@example.com")).toBeDefined();
    expect(screen.getByText("Test E-Book")).toBeDefined();
    expect(screen.getByText("by Author Name")).toBeDefined();
    expect(screen.getByText("$10.00")).toBeDefined();
    expect(screen.getByText("Successful")).toBeDefined();

    expect(screen.getByText("second@example.com")).toBeDefined();
    expect(screen.getByText("Coffee Support")).toBeDefined();
    expect(screen.getByText("In progress")).toBeDefined();
  });

  it("renders empty state when there are no recent orders", () => {
    const emptyProps: OverviewProps = {
      ...mockProps,
      recent_orders: [],
    };

    render(<Overview {...emptyProps} />);

    expect(screen.getByText("No orders have been recorded yet.")).toBeDefined();
  });

  it("triggers range change when range tab is clicked", () => {
    render(<Overview {...mockProps} />);

    const tab7 = screen.getByRole("tab", { name: "7 days" });
    fireEvent.click(tab7);

    expect(router.get).toHaveBeenCalledWith(
      "/admin",
      { range: 7 },
      expect.objectContaining({ preserveState: true, replace: true }),
    );
  });
});
