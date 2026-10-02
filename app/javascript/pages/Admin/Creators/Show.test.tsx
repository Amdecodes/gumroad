// @vitest-environment happy-dom
import { router } from "@inertiajs/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Show, { type CreatorShowProps } from "./Show";

vi.mock("@inertiajs/react", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@inertiajs/react")>();
  return {
    ...mod,
    router: {
      post: vi.fn(),
    },
    usePage: () => ({ url: "/admin/creators/usr_1", props: {} }),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockCreatorShowProps: CreatorShowProps = {
  profile: {
    external_id: "usr_1001",
    username: "alicepro",
    display_name: "Alice Designer",
    email: "alice@example.com",
    avatar_url: "/avatars/alice.png",
    bio: "Digital product creator & designer",
    joined_at: "2026-05-10T10:00:00Z",
    status: "active",
    verified_status: true,
  },
  metrics: {
    lifetime_revenue_cents: 125000,
    formatted_lifetime_revenue: "$1,250.00",
    sales_count: 50,
    active_products_count: 3,
    customer_count: 45,
  },
  products: [
    {
      id: "prod_1",
      title: "UI Design Kit",
      price_formatted: "$49.00",
      sales_count: 30,
      status: "published",
      published_date: "2026-06-01T12:00:00Z",
    },
  ],
  payment_info: {
    payout_setup: true,
    payouts_paused: false,
    payouts_paused_reason: null,
    payment_address: "alice@paypal.com",
    paypal_email: "alice@paypal.com",
    verified: true,
  },
  impersonate_url: "/admin/impersonate?user_id=usr_1001",
  audit_history: [
    {
      id: "log_1",
      action: "users.mark_compliant",
      actor_name: "Admin Lead",
      created_at: "2026-05-11T12:00:00Z",
      response_status: 200,
    },
  ],
};

describe("Admin Creator Detail (Show) Page", () => {
  it("renders profile, metrics, products, and payment information", () => {
    render(<Show {...mockCreatorShowProps} />);

    // Header info
    expect(screen.getByRole("heading", { name: /alice designer/iu })).toBeDefined();
    expect(screen.getAllByText(/@alicepro/iu).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("alice@example.com").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/verified/iu).length).toBeGreaterThanOrEqual(1);

    // Metrics
    expect(screen.getByText("$1,250.00")).toBeDefined();
    expect(screen.getByText("50")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText("45")).toBeDefined();

    // Products table
    expect(screen.getByText("UI Design Kit")).toBeDefined();
    expect(screen.getByText("$49.00")).toBeDefined();
    expect(screen.getByText("published")).toBeDefined();

    // Payment & Compliance
    expect(screen.getByText("Configured")).toBeDefined();
    expect(screen.getAllByText("alice@paypal.com").length).toBeGreaterThanOrEqual(1);

    // Impersonate button
    const impersonateLink = screen.getByRole("link", { name: /impersonate/iu });
    expect(impersonateLink.getAttribute("href")).toBe("/admin/impersonate?user_id=usr_1001");
  });

  describe("Suspend Modal", () => {
    it("opens suspend modal, requires a reason, and submits to suspend endpoint", () => {
      render(<Show {...mockCreatorShowProps} />);

      const suspendButton = screen.getByRole("button", { name: /suspend creator/iu });
      fireEvent.click(suspendButton);

      expect(screen.getByRole("heading", { name: "Suspend Creator Account" })).toBeDefined();

      const confirmButton = screen.getByRole("button", { name: "Confirm Suspension" });
      const reasonInput = screen.getByPlaceholderText(/describe the reason for suspension/iu);

      // Button is disabled when reason is empty
      expect(confirmButton.hasAttribute("disabled")).toBe(true);

      fireEvent.change(reasonInput, { target: { value: "Terms of service violation" } });
      expect(confirmButton.hasAttribute("disabled")).toBe(false);

      fireEvent.click(confirmButton);

      expect(router.post).toHaveBeenCalledWith(
        "/admin/creators/usr_1001/suspend",
        {
          reason: "Terms of service violation",
          reason_type: "tos_violation",
        },
        expect.objectContaining({ preserveScroll: true }),
      );
    });
  });

  describe("Unsuspend Modal", () => {
    it("renders unsuspend button for suspended creator and submits unsuspend", () => {
      const suspendedProps: CreatorShowProps = {
        ...mockCreatorShowProps,
        profile: {
          ...mockCreatorShowProps.profile,
          status: "suspended",
        },
      };

      render(<Show {...suspendedProps} />);

      const unsuspendButton = screen.getByRole("button", { name: /unsuspend creator/iu });
      fireEvent.click(unsuspendButton);

      expect(screen.getByRole("heading", { name: "Unsuspend Creator Account" })).toBeDefined();

      const confirmButton = screen.getByRole("button", { name: "Lift Suspension" });
      const reasonInput = screen.getByPlaceholderText(/enter justification for lifting suspension/iu);

      expect(confirmButton.hasAttribute("disabled")).toBe(true);

      fireEvent.change(reasonInput, { target: { value: "Review cleared and resolved" } });
      expect(confirmButton.hasAttribute("disabled")).toBe(false);

      fireEvent.click(confirmButton);

      expect(router.post).toHaveBeenCalledWith(
        "/admin/creators/usr_1001/unsuspend",
        {
          reason: "Review cleared and resolved",
        },
        expect.objectContaining({ preserveScroll: true }),
      );
    });
  });
});
