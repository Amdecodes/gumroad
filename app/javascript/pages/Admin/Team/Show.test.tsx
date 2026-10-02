// @vitest-environment happy-dom
import { router } from "@inertiajs/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Show, { type TeamMemberShowProps } from "./Show";

vi.mock("@inertiajs/react", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@inertiajs/react")>();
  return {
    ...mod,
    router: {
      get: vi.fn(),
      post: vi.fn(),
      visit: vi.fn(),
    },
    usePage: () => ({ url: "/admin/team/staff_1", props: {} }),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockMemberProps: TeamMemberShowProps = {
  member: {
    id: "staff_1",
    username: "alicesmith",
    name: "Alice Smith",
    email: "alice@gumroad.com",
    avatar_url: "/avatars/alice.png",
    bio: "Head of Developer Support",
    is_root_account: false,
    is_current_user: false,
    role_label: "Staff Member",
    joined_at: "2025-03-01T00:00:00Z",
    formatted_joined_at: "March 01, 2025",
    two_factor_enabled: true,
    confirmed: true,
    can_revoke: true,
  },
  stats: {
    actions_count: 53,
    first_action_at: "2025-03-10T10:00:00Z",
    latest_action_at: "2026-10-01T15:00:00Z",
    formatted_latest_action_at: "Oct 01, 2026 15:00 UTC",
  },
  recent_actions: [
    {
      id: "act_1",
      action: "users.create_comment",
      humanized_action: "Users → Create Comment",
      target_type: "User",
      target_external_id: "usr_buyer_99",
      target_link: "/admin/creators/usr_buyer_99",
      route: "/internal/admin/users/create_comment",
      response_status: 200,
      status: "success",
      created_at: "2026-10-01T15:00:00Z",
      formatted_created_at: "Oct 01, 2026 15:00:00 UTC",
    },
  ],
  impersonate_url: "/admin/impersonate?user_id=staff_1",
};

describe("Admin Team Show Page", () => {
  it("renders member profile, stats, and recent actions", () => {
    render(<Show {...mockMemberProps} />);

    expect(screen.getByRole("heading", { name: "Alice Smith" })).toBeDefined();
    expect(screen.getAllByText("alice@gumroad.com").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("53")).toBeDefined();
    expect(screen.getByText("Enabled")).toBeDefined();
    expect(screen.getByText("Head of Developer Support")).toBeDefined();
    expect(screen.getByText("Users → Create Comment")).toBeDefined();
  });

  it("handles revocation flow from show page", () => {
    render(<Show {...mockMemberProps} />);

    const revokeBtn = screen.getByRole("button", { name: /Revoke Access/iu });
    fireEvent.click(revokeBtn);

    expect(screen.getByText(/Are you sure you want to revoke administrative access/iu)).toBeDefined();

    const confirmBtn = screen.getByRole("button", { name: /Confirm Revocation/iu });
    fireEvent.click(confirmBtn);

    expect(router.post).toHaveBeenCalledWith(
      "/admin/team/staff_1/revoke",
      expect.objectContaining({ reason: "" }),
      expect.anything(),
    );
  });
});
