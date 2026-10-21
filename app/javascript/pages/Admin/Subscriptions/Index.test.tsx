// @vitest-environment happy-dom
import { router } from "@inertiajs/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Index, { type SubscriptionsIndexProps, type SubscriptionSummary } from "./Index";

vi.mock("@inertiajs/react", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@inertiajs/react")>();
  return {
    ...mod,
    router: {
      get: vi.fn(),
      post: vi.fn(),
    },
    usePage: () => ({ url: "/admin/subscriptions", props: {} }),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockSubscriptions: SubscriptionSummary[] = [
  {
    id: "sub_1",
    subscriber_email: "subscriber@example.com",
    subscriber_name: "Abebe Subscriber",
    product_name: "Pro Club",
    product_id: "prod_1",
    seller_name: "Creator Alpha",
    seller_id: "seller_1",
    amount_formatted: "500.00 ETB",
    frequency: "monthly",
    status: "active",
    created_at: "2026-10-01T12:00:00Z",
    current_period_end: "2026-11-01T12:00:00Z",
  },
  {
    id: "sub_2",
    subscriber_email: "failing@example.com",
    subscriber_name: "Chala Tester",
    product_name: "Design Community",
    product_id: "prod_2",
    seller_name: "Creator Beta",
    seller_id: "seller_2",
    amount_formatted: "300.00 ETB",
    frequency: "monthly",
    status: "failing",
    created_at: "2026-09-15T12:00:00Z",
    current_period_end: "2026-10-18T12:00:00Z",
  },
];

const defaultProps: SubscriptionsIndexProps = {
  subscriptions: mockSubscriptions,
  pagination: {
    page: 1,
    pages: 1,
    count: 2,
    has_more: false,
  },
  filters: {},
};

describe("Admin Subscriptions Index Page", () => {
  it("renders subscriptions table and summary information", () => {
    render(<Index {...defaultProps} />);

    expect(screen.getByRole("heading", { name: "Subscriptions" })).toBeDefined();
    expect(screen.getByText("subscriber@example.com")).toBeDefined();
    expect(screen.getByText("Abebe Subscriber")).toBeDefined();
    expect(screen.getByText("Pro Club")).toBeDefined();
    expect(screen.getByText("Creator Alpha")).toBeDefined();
    expect(screen.getByText("500.00 ETB")).toBeDefined();
    expect(screen.getAllByText("Active").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Failing / Grace")).toBeDefined();
  });

  it("submits search query and triggers Inertia navigation", () => {
    render(<Index {...defaultProps} />);

    const searchInput = screen.getByLabelText("Search subscriptions");
    fireEvent.change(searchInput, { target: { value: "subscriber@example.com" } });
    fireEvent.submit(searchInput.closest("form") ?? document.createElement("form"));

    expect(router.get).toHaveBeenCalledWith(
      "/admin/subscriptions",
      { q: "subscriber@example.com" },
      expect.objectContaining({ preserveState: true }),
    );
  });

  it("filters by status dropdown", () => {
    render(<Index {...defaultProps} />);

    const select = screen.getByLabelText("Filter by subscription status");
    fireEvent.change(select, { target: { value: "failing" } });

    expect(router.get).toHaveBeenCalledWith(
      "/admin/subscriptions",
      { status: "failing" },
      expect.objectContaining({ preserveState: true }),
    );
  });

  it("renders empty state when no subscriptions match", () => {
    render(
      <Index
        {...defaultProps}
        subscriptions={[]}
        pagination={{ page: 1, pages: 1, count: 0, has_more: false }}
        filters={{ q: "nonexistent" }}
      />,
    );

    expect(screen.getByText("No subscriptions found")).toBeDefined();
    expect(screen.getByText("Clear Filters")).toBeDefined();
  });
});
