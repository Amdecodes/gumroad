// @vitest-environment happy-dom
import { router } from "@inertiajs/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Index, { type OrdersIndexProps, type OrderSummary } from "./Index";

vi.mock("@inertiajs/react", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@inertiajs/react")>();
  return {
    ...mod,
    router: {
      get: vi.fn(),
      post: vi.fn(),
    },
    usePage: () => ({ url: "/admin/orders", props: {} }),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockOrders: OrderSummary[] = [
  {
    id: "ord_1",
    external_id_numeric: "1001",
    customer_email: "alice@example.com",
    product_name: "React Mastery",
    seller_name: "Tech Press",
    amount_formatted: "$49.00",
    status: "successful",
    refund_status: null,
    created_at: "2026-09-15T10:30:00Z",
  },
  {
    id: "ord_2",
    external_id_numeric: "1002",
    customer_email: "bob@example.com",
    product_name: "Design Systems",
    seller_name: "UI Studio",
    amount_formatted: "$29.00",
    status: "successful",
    refund_status: "refunded",
    created_at: "2026-09-14T08:00:00Z",
  },
  {
    id: "ord_3",
    external_id_numeric: "1003",
    customer_email: "charlie@example.com",
    product_name: "Failing Product",
    seller_name: "Broken Shop",
    amount_formatted: "$10.00",
    status: "failed",
    refund_status: null,
    created_at: "2026-09-13T12:00:00Z",
  },
];

const defaultProps: OrdersIndexProps = {
  orders: mockOrders,
  pagination: {
    page: 1,
    pages: 3,
    count: 75,
    has_more: true,
  },
  filters: {
    q: "",
    status: "",
    date: "",
  },
};

describe("Admin Orders Index Page", () => {
  it("renders page header and orders table with correct data", () => {
    render(<Index {...defaultProps} />);

    expect(screen.getByRole("heading", { name: "Orders" })).toBeDefined();
    expect(screen.getByText("Search, inspect, and manage purchases across ArifDrop")).toBeDefined();

    // Check Alice order
    expect(screen.getByText("alice@example.com")).toBeDefined();
    expect(screen.getByText("React Mastery")).toBeDefined();
    expect(screen.getByText("Tech Press")).toBeDefined();
    expect(screen.getByText("$49.00")).toBeDefined();
    expect(screen.getAllByText("Successful").length).toBeGreaterThanOrEqual(1);

    // Check Bob refunded order
    expect(screen.getByText("bob@example.com")).toBeDefined();
    expect(screen.getByText("Design Systems")).toBeDefined();
    expect(screen.getByText("UI Studio")).toBeDefined();
    expect(screen.getByText("$29.00")).toBeDefined();
    expect(screen.getAllByText("Refunded").length).toBeGreaterThanOrEqual(1);

    // Check Charlie failed order
    expect(screen.getByText("charlie@example.com")).toBeDefined();
    expect(screen.getAllByText("Failed").length).toBeGreaterThanOrEqual(1);
  });

  it("renders empty state when there are no orders", () => {
    render(<Index {...defaultProps} orders={[]} pagination={{ page: 1, pages: 1, count: 0, has_more: false }} />);

    expect(screen.getByText("No orders found")).toBeDefined();
    expect(screen.getByText("No orders have been recorded in the platform yet.")).toBeDefined();
  });

  it("submits search query with router.get", () => {
    render(<Index {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/search by customer email/iu);
    fireEvent.change(searchInput, { target: { value: "alice@example.com" } });

    const searchForm = searchInput.closest("form");
    expect(searchForm).not.toBeNull();
    if (searchForm) {
      fireEvent.submit(searchForm);
    }

    expect(router.get).toHaveBeenCalledWith(
      "/admin/orders",
      { q: "alice@example.com" },
      expect.objectContaining({ preserveState: true, replace: true }),
    );
  });

  it("triggers filter on status change", () => {
    render(<Index {...defaultProps} />);

    const statusSelect = screen.getByLabelText(/filter by status/iu);
    fireEvent.change(statusSelect, { target: { value: "refunded" } });

    expect(router.get).toHaveBeenCalledWith(
      "/admin/orders",
      { status: "refunded" },
      expect.objectContaining({ preserveState: true, replace: true }),
    );
  });

  it("triggers filter on date change", () => {
    render(<Index {...defaultProps} />);

    const dateInput = screen.getByLabelText(/filter by date/iu);
    fireEvent.change(dateInput, { target: { value: "2026-09-15" } });

    expect(router.get).toHaveBeenCalledWith(
      "/admin/orders",
      { date: "2026-09-15" },
      expect.objectContaining({ preserveState: true, replace: true }),
    );
  });

  it("clears filters when clicking the clear button", () => {
    render(<Index {...defaultProps} filters={{ q: "test", status: "successful", date: "2026-09-15" }} />);

    const clearButton = screen.getByRole("button", { name: /clear/iu });
    fireEvent.click(clearButton);

    expect(router.get).toHaveBeenCalledWith(
      "/admin/orders",
      {},
      expect.objectContaining({ preserveState: true, replace: true }),
    );
  });
});
