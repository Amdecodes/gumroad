// @vitest-environment happy-dom
import { router } from "@inertiajs/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Index, { type CustomerSummary, type CustomersIndexProps } from "./Index";

vi.mock("@inertiajs/react", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@inertiajs/react")>();
  return {
    ...mod,
    router: {
      get: vi.fn(),
      post: vi.fn(),
    },
    usePage: () => ({ url: "/admin/customers", props: {} }),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockCustomers: CustomerSummary[] = [
  {
    id: "usr_101",
    email: "customer1@example.com",
    name: "Almaz Kebede",
    orders_count: 3,
    total_spent_cents: 150000,
    total_spent_formatted: "1,500.00 ETB",
    active_subscriptions_count: 1,
    is_registered: true,
    user_id: "usr_101",
    last_seen_at: "2026-10-05T10:00:00Z",
  },
  {
    id: "guest_202",
    email: "guest@example.com",
    name: "Abebe Guest",
    orders_count: 1,
    total_spent_cents: 45000,
    total_spent_formatted: "450.00 ETB",
    active_subscriptions_count: 0,
    is_registered: false,
    user_id: null,
    last_seen_at: "2026-10-04T15:00:00Z",
  },
];

const defaultProps: CustomersIndexProps = {
  customers: mockCustomers,
  pagination: {
    page: 1,
    pages: 1,
    count: 2,
    has_more: false,
  },
  filters: {},
};

describe("Admin Customers Index Page", () => {
  it("renders customer directory table and stats", () => {
    render(<Index {...defaultProps} />);

    expect(screen.getByRole("heading", { name: "Customers" })).toBeDefined();
    expect(screen.getByText("customer1@example.com")).toBeDefined();
    expect(screen.getByText("Almaz Kebede")).toBeDefined();
    expect(screen.getByText("1,500.00 ETB")).toBeDefined();
    expect(screen.getByText("Registered User")).toBeDefined();
    expect(screen.getByText("guest@example.com")).toBeDefined();
    expect(screen.getByText("Guest Buyer")).toBeDefined();
    expect(screen.getByText("1 Active")).toBeDefined();
  });

  it("triggers search navigation when form is submitted", () => {
    render(<Index {...defaultProps} />);

    const searchInput = screen.getByLabelText("Search customers");
    fireEvent.change(searchInput, { target: { value: "customer1" } });
    fireEvent.submit(searchInput.closest("form") ?? document.createElement("form"));

    expect(router.get).toHaveBeenCalledWith(
      "/admin/customers",
      { q: "customer1" },
      expect.objectContaining({ preserveState: true }),
    );
  });

  it("renders empty state correctly", () => {
    render(
      <Index
        {...defaultProps}
        customers={[]}
        pagination={{ page: 1, pages: 1, count: 0, has_more: false }}
        filters={{ q: "notfound" }}
      />,
    );

    expect(screen.getByText("No customers found")).toBeDefined();
    expect(screen.getByText("Clear Search")).toBeDefined();
  });
});
