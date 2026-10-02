// @vitest-environment happy-dom
import { router } from "@inertiajs/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Index, { type TeamIndexProps, type TeamMemberSummary } from "./Index";

vi.mock("@inertiajs/react", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@inertiajs/react")>();
  return {
    ...mod,
    router: {
      get: vi.fn(),
      post: vi.fn(),
      visit: vi.fn(),
    },
    usePage: () => ({ url: "/admin/team", props: {} }),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockTeam: TeamMemberSummary[] = [
  {
    id: "lead_1",
    username: "adminlead",
    name: "Admin Lead",
    email: "lead@gumroad.com",
    is_root_account: false,
    is_current_user: true,
    role_label: "Staff Member",
    joined_at: "2025-01-01T00:00:00Z",
    formatted_joined_at: "Jan 01, 2025",
    actions_count: 42,
    last_active_at: "2026-10-02T10:00:00Z",
    formatted_last_active_at: "Oct 02, 2026 10:00 UTC",
    can_revoke: false,
  },
  {
    id: "root_1",
    username: "gumroad",
    name: "Root Platform",
    email: "hi@gumroad.com",
    is_root_account: true,
    is_current_user: false,
    role_label: "Platform Owner",
    joined_at: "2024-01-01T00:00:00Z",
    formatted_joined_at: "Jan 01, 2024",
    actions_count: 100,
    last_active_at: "2026-10-01T10:00:00Z",
    formatted_last_active_at: "Oct 01, 2026 10:00 UTC",
    can_revoke: false,
  },
  {
    id: "staff_2",
    username: "junioradmin",
    name: "Junior Admin",
    email: "junior@gumroad.com",
    is_root_account: false,
    is_current_user: false,
    role_label: "Staff Member",
    joined_at: "2026-05-01T00:00:00Z",
    formatted_joined_at: "May 01, 2026",
    actions_count: 5,
    last_active_at: "2026-09-30T10:00:00Z",
    formatted_last_active_at: "Sep 30, 2026 10:00 UTC",
    can_revoke: true,
  },
];

const defaultProps: TeamIndexProps = {
  team_members: mockTeam,
  pagy: {
    page: 1,
    pages: 1,
    count: 3,
    next_page: null,
    prev_page: null,
    has_more: false,
  },
  filters: {},
};

describe("Admin Team Index Page", () => {
  it("renders page header and team member rows", () => {
    render(<Index {...defaultProps} />);

    expect(screen.getByRole("heading", { name: /Team Management/iu })).toBeDefined();
    expect(screen.getByText("Admin Lead")).toBeDefined();
    expect(screen.getByText("Root Platform")).toBeDefined();
    expect(screen.getByText("Junior Admin")).toBeDefined();
    expect(screen.getByText("You")).toBeDefined();
  });

  it("renders Revoke button only for eligible members", () => {
    render(<Index {...defaultProps} />);

    const revokeButtons = screen.getAllByRole("button", { name: /revoke/iu });
    expect(revokeButtons.length).toBe(1); // Only Junior Admin has can_revoke: true
  });

  it("opens confirmation modal and posts revocation request", () => {
    render(<Index {...defaultProps} />);

    const revokeBtn = screen.getByRole("button", { name: /revoke/iu });
    fireEvent.click(revokeBtn);

    expect(screen.getByText(/Are you sure you want to revoke administrative access/iu)).toBeDefined();

    const confirmBtn = screen.getByRole("button", { name: /Confirm Revocation/iu });
    fireEvent.click(confirmBtn);

    expect(router.post).toHaveBeenCalledWith(
      "/admin/team/staff_2/revoke",
      expect.objectContaining({ reason: "" }),
      expect.anything(),
    );
  });
});
