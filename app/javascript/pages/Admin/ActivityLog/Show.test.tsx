// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Show, { type ActivityLogDetailProps } from "./Show";

vi.mock("@inertiajs/react", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@inertiajs/react")>();
  return {
    ...mod,
    router: {
      get: vi.fn(),
      post: vi.fn(),
      visit: vi.fn(),
    },
    usePage: () => ({ url: "/admin/activity-log/1", props: {} }),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockLogProps: ActivityLogDetailProps = {
  log: {
    id: "101",
    action: "users.suspend_for_fraud",
    humanized_action: "Users → Suspend For Fraud",
    actor: {
      id: "admin_1",
      name: "Security Lead",
      email: "security@gumroad.com",
    },
    target_type: "User",
    target_id: "77",
    target_external_id: "usr_77",
    target_link: "/admin/creators/usr_77",
    route: "/internal/admin/users/suspend_for_fraud",
    http_method: "POST",
    response_status: 200,
    status: "success",
    request_id: "req_xyz_123",
    params_snapshot: {
      user_id: "usr_77",
      suspension_note: "Identified stolen credit card usage",
    },
    token: {
      external_id: "tok_admin_999",
      scope: "admin",
    },
    created_at: "2026-10-01T12:00:00Z",
    formatted_created_at: "Oct 01, 2026 12:00:00 UTC",
  },
};

describe("Admin ActivityLog Show Page", () => {
  it("renders log details and params snapshot", () => {
    render(<Show {...mockLogProps} />);

    expect(screen.getByRole("heading", { name: /Activity Log #101/iu })).toBeDefined();
    expect(screen.getByText("Users → Suspend For Fraud")).toBeDefined();
    expect(screen.getByText("Security Lead")).toBeDefined();
    expect(screen.getByText("security@gumroad.com")).toBeDefined();
    expect(screen.getByText("usr_77")).toBeDefined();
    expect(screen.getByText(/req_xyz_123/iu)).toBeDefined();
    expect(screen.getByText(/Identified stolen credit card usage/iu)).toBeDefined();
  });

  it("links to target resource when available", () => {
    render(<Show {...mockLogProps} />);

    const targetButton = screen.getByRole("button", { name: /View Target User/iu });
    expect(targetButton).toBeDefined();
  });
});
