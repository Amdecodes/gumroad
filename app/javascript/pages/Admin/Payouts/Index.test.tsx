// @vitest-environment happy-dom
import { router } from "@inertiajs/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Index, { type PayoutsIndexProps, type PayoutSummary } from "./Index";

vi.mock("@inertiajs/react", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@inertiajs/react")>();
  return {
    ...mod,
    router: {
      get: vi.fn(),
      post: vi.fn(),
      visit: vi.fn(),
    },
    usePage: () => ({ url: "/admin/payouts", props: {} }),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockPayouts: PayoutSummary[] = [
  {
    id: "pay_1",
    external_id: "pay_1",
    reference: "tx_stripe_123",
    amount_cents: 12500,
    formatted_amount: "$125.00",
    currency: "usd",
    status: "completed",
    destination_method: "Bank ******6789",
    created_at: "2026-09-20T10:00:00Z",
    creator: {
      external_id: "usr_1",
      name: "Alice Designer",
      username: "alice",
      email: "alice@example.com",
      avatar_url: "/avatars/alice.png",
      admin_path: "/admin/creators/alice",
    },
  },
  {
    id: "pay_2",
    external_id: "pay_2",
    reference: "sp_pending_456",
    amount_cents: 8000,
    formatted_amount: "$80.00",
    currency: "usd",
    status: "pending",
    destination_method: "PayPal (bob@example.com)",
    created_at: "2026-09-25T14:30:00Z",
    creator: {
      external_id: "usr_2",
      name: "Bob Dev",
      username: "bob",
      email: "bob@example.com",
      avatar_url: "/avatars/bob.png",
      admin_path: "/admin/creators/bob",
    },
  },
];

const defaultProps: PayoutsIndexProps = {
  payouts: mockPayouts,
  pagy: {
    page: 1,
    pages: 2,
    count: 24,
    has_more: true,
  },
  metrics: {
    pending_count: 5,
    pending_amount_cents: 45000,
    formatted_pending_amount: "$450.00",
    completed_count_30d: 19,
    completed_amount_cents_30d: 125000,
    formatted_completed_amount_30d: "$1,250.00",
  },
  filters: {
    q: "",
    status: "all",
  },
};

describe("Admin Payouts Index Page", () => {
  it("renders metric cards and payouts table with proper columns", () => {
    render(<Index {...defaultProps} />);

    expect(screen.getByRole("heading", { name: /payouts/iu })).toBeDefined();

    // Metric summary cards
    expect(screen.getByText("$450.00")).toBeDefined();
    expect(screen.getByText("(5 payouts)")).toBeDefined();
    expect(screen.getByText("$1,250.00")).toBeDefined();
    expect(screen.getByText("(19 payouts)")).toBeDefined();

    // Row 1 (Alice)
    expect(screen.getByText("tx_stripe_123")).toBeDefined();
    expect(screen.getByText("Alice Designer")).toBeDefined();
    expect(screen.getByText(/@alice/iu)).toBeDefined();
    expect(screen.getByText("$125.00")).toBeDefined();
    expect(screen.getByText("Bank ******6789")).toBeDefined();
    expect(screen.getAllByText("Completed").length).toBeGreaterThanOrEqual(1);

    // Row 2 (Bob)
    expect(screen.getByText("sp_pending_456")).toBeDefined();
    expect(screen.getByText("Bob Dev")).toBeDefined();
    expect(screen.getByText(/@bob/iu)).toBeDefined();
    expect(screen.getByText("$80.00")).toBeDefined();
    expect(screen.getByText("PayPal (bob@example.com)")).toBeDefined();
    expect(screen.getAllByText("Pending").length).toBeGreaterThanOrEqual(1);
  });

  it("renders empty state when there are no payouts", () => {
    render(<Index {...defaultProps} payouts={[]} pagy={{ page: 1, pages: 1, count: 0, has_more: false }} />);

    expect(screen.getByText("No payouts found")).toBeDefined();
    expect(screen.getByText(/there are currently no recorded payouts/iu)).toBeDefined();
  });

  it("submits search query via router.get", () => {
    render(<Index {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/search by creator name, email, or payout reference/iu);
    fireEvent.change(searchInput, { target: { value: "alice" } });

    const searchForm = searchInput.closest("form");
    expect(searchForm).not.toBeNull();
    if (searchForm) {
      fireEvent.submit(searchForm);
    }

    expect(router.get).toHaveBeenCalledWith(
      "/admin/payouts",
      { q: "alice" },
      expect.objectContaining({ preserveState: true, preserveScroll: true }),
    );
  });

  it("filters by status on dropdown change", () => {
    render(<Index {...defaultProps} />);

    const statusSelect = screen.getByLabelText(/filter by status/iu);
    fireEvent.change(statusSelect, { target: { value: "pending" } });

    expect(router.get).toHaveBeenCalledWith(
      "/admin/payouts",
      { status: "pending" },
      expect.objectContaining({ preserveState: true, preserveScroll: true }),
    );
  });

  it("clears filters when clicking the reset button", () => {
    render(<Index {...defaultProps} filters={{ q: "alice", status: "completed" }} />);

    const resetButton = screen.getByRole("button", { name: /reset/iu });
    fireEvent.click(resetButton);

    expect(router.get).toHaveBeenCalledWith(
      "/admin/payouts",
      {},
      expect.objectContaining({ preserveState: true, preserveScroll: true }),
    );
  });
});
