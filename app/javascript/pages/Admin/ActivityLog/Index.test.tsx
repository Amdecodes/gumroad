// @vitest-environment happy-dom
import { router } from "@inertiajs/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Index, { type ActivityLogItem, type ActivityLogsIndexProps } from "./Index";

vi.mock("@inertiajs/react", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@inertiajs/react")>();
  return {
    ...mod,
    router: {
      get: vi.fn(),
      post: vi.fn(),
      visit: vi.fn(),
    },
    usePage: () => ({ url: "/admin/activity-log", props: {} }),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockLogs: ActivityLogItem[] = [
  {
    id: "1",
    action: "users.suspend_for_fraud",
    humanized_action: "Users → Suspend For Fraud",
    actor: {
      id: "admin_1",
      name: "Admin Lead",
      email: "lead@gumroad.com",
    },
    target_type: "User",
    target_id: "7",
    target_external_id: "usr_7",
    target_link: "/admin/creators/usr_7",
    route: "/internal/admin/users/suspend_for_fraud",
    http_method: "POST",
    response_status: 200,
    status: "success",
    created_at: "2026-10-01T12:00:00Z",
    formatted_created_at: "Oct 01, 2026 12:00:00 UTC",
  },
  {
    id: "2",
    action: "purchases.refund",
    humanized_action: "Purchases → Refund",
    actor: {
      id: "admin_2",
      name: "Staff Agent",
      email: "agent@gumroad.com",
    },
    target_type: "Purchase",
    target_id: "42",
    target_external_id: "ord_42",
    target_link: "/admin/orders/ord_42",
    route: "/internal/admin/purchases/ord_42/refund",
    http_method: "POST",
    response_status: 422,
    status: "failure",
    error_class: "RefundFailedError",
    created_at: "2026-10-02T10:00:00Z",
    formatted_created_at: "Oct 02, 2026 10:00:00 UTC",
  },
];

const defaultProps: ActivityLogsIndexProps = {
  logs: mockLogs,
  pagy: {
    page: 1,
    pages: 2,
    count: 25,
    next_page: 2,
    prev_page: null,
    has_more: true,
  },
  available_actions: ["users.suspend_for_fraud", "purchases.refund"],
  available_actors: [
    { id: "admin_1", name: "Admin Lead", email: "lead@gumroad.com" },
    { id: "admin_2", name: "Staff Agent", email: "agent@gumroad.com" },
  ],
  filters: {},
};

describe("Admin ActivityLog Index Page", () => {
  it("renders page header and audit log entries", () => {
    render(<Index {...defaultProps} />);

    expect(screen.getByRole("heading", { name: /Activity Log/iu })).toBeDefined();
    expect(screen.getByText("Users → Suspend For Fraud")).toBeDefined();
    expect(screen.getByText("Purchases → Refund")).toBeDefined();
    expect(screen.getByText("Admin Lead")).toBeDefined();
    expect(screen.getByText("Staff Agent")).toBeDefined();
  });

  it("submits search query on form submission", () => {
    render(<Index {...defaultProps} />);

    const searchInput = screen.getByLabelText(/search activity logs/iu);
    fireEvent.change(searchInput, { target: { value: "suspend" } });

    const submitBtn = screen.getByRole("button", { name: /filter/iu });
    fireEvent.click(submitBtn);

    expect(router.get).toHaveBeenCalledWith(
      "/admin/activity-log",
      expect.objectContaining({ q: "suspend" }),
      expect.anything(),
    );
  });

  it("filters by status selection", () => {
    render(<Index {...defaultProps} />);

    const statusSelect = screen.getByLabelText(/filter by status/iu);
    fireEvent.change(statusSelect, { target: { value: "failure" } });

    expect(router.get).toHaveBeenCalledWith(
      "/admin/activity-log",
      expect.objectContaining({ status: "failure" }),
      expect.anything(),
    );
  });

  it("renders empty state when no logs exist", () => {
    render(<Index {...defaultProps} logs={[]} filters={{ q: "nonexistent" }} />);

    expect(screen.getByText(/no activity log entries found/iu)).toBeDefined();
    expect(screen.getByRole("button", { name: /clear filters/iu })).toBeDefined();
  });
});
