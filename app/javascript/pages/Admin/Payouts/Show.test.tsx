// @vitest-environment happy-dom
import { router } from "@inertiajs/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Show, { type PayoutDetailProps } from "./Show";

vi.mock("@inertiajs/react", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@inertiajs/react")>();
  return {
    ...mod,
    router: {
      post: vi.fn(),
      visit: vi.fn(),
    },
    usePage: () => ({ url: "/admin/payouts/sp_101", props: {} }),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockPayoutDetail: PayoutDetailProps = {
  payout: {
    external_id: "sp_101",
    reference: "sp_101",
    amount_cents: 25000,
    formatted_amount: "250.00 ETB",
    currency: "ETB",
    status: "pending",
    date_requested: "2026-09-28T12:00:00Z",
    date_processed: null,
    processor: "Chapa",
    can_mark_paid: true,
    can_cancel: true,
  },
  creator: {
    external_id: "usr_500",
    name: "Carol Artisan",
    username: "carolart",
    email: "carol@example.com",
    avatar_url: "/avatars/carol.png",
    admin_path: "/admin/creators/carolart",
  },
  destination: {
    method_type: "bank",
    processor: "Chapa",
    bank_name: "Commercial Bank of Ethiopia",
    account_number_visual: "******4321",
    routing_number: "121000358",
    account_holder_name: "Carol Artisan LLC",
    account_type: "checking",
  },
  breakdown: {
    sales_volume_cents: 28000,
    formatted_sales_volume: "280.00 ETB",
    platform_fee_cents: 2500,
    formatted_platform_fee: "25.00 ETB",
    processor_fee_cents: 500,
    formatted_processor_fee: "5.00 ETB",
    adjustments_cents: 0,
    formatted_adjustments: "0.00 ETB",
    net_amount_cents: 25000,
    formatted_net_amount: "250.00 ETB",
  },
  audit_history: [
    {
      id: 1,
      action: "scheduled_payouts.create",
      actor_name: "Admin Risk Lead",
      actor_email: "risk@example.com",
      created_at: "2026-09-28T12:00:00Z",
      response_status: 200,
      note: "Initial scheduled payout creation",
    },
  ],
};

describe("Admin Payouts Show Page", () => {
  it("renders payout overview, financial breakdown, creator profile, and destination account", () => {
    render(<Show {...mockPayoutDetail} />);

    // Header info
    expect(screen.getByRole("heading", { name: "Payout #sp_101" })).toBeDefined();
    expect(screen.getAllByText(/carol artisan/iu).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Pending").length).toBeGreaterThanOrEqual(1);

    // Financial Breakdown
    expect(screen.getAllByText("250.00 ETB").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("280.00 ETB")).toBeDefined();
    expect(screen.getByText("-25.00 ETB")).toBeDefined();
    expect(screen.getByText("-5.00 ETB")).toBeDefined();

    // Destination Info
    expect(screen.getByText("Commercial Bank of Ethiopia")).toBeDefined();
    expect(screen.getByText("******4321")).toBeDefined();
    expect(screen.getByText("121000358")).toBeDefined();
    expect(screen.getByText("Carol Artisan LLC")).toBeDefined();

    // Audit History
    expect(screen.getByText("scheduled_payouts.create")).toBeDefined();
    expect(screen.getByText("Admin Risk Lead")).toBeDefined();
    expect(screen.getByText("Initial scheduled payout creation")).toBeDefined();
  });

  describe("Mark as Paid Modal Dialog", () => {
    it("opens dialog, allows typing an optional note, and submits to mark_paid endpoint", () => {
      render(<Show {...mockPayoutDetail} />);

      const markPaidButton = screen.getByRole("button", { name: /mark as paid/iu });
      fireEvent.click(markPaidButton);

      expect(screen.getByRole("heading", { name: "Approve & Mark Payout as Paid" })).toBeDefined();

      const noteInput = screen.getByPlaceholderText(/wire reference/iu);
      fireEvent.change(noteInput, { target: { value: "Wire reference #998877" } });

      const confirmButton = screen.getByRole("button", { name: "Confirm & Release Payout" });
      fireEvent.click(confirmButton);

      expect(router.post).toHaveBeenCalledWith(
        "/admin/payouts/sp_101/mark_paid",
        { note: "Wire reference #998877" },
        expect.anything(),
      );
    });
  });

  describe("Cancel / Hold Modal Dialog", () => {
    it("opens dialog, requires mandatory reason, and submits to cancel endpoint", () => {
      render(<Show {...mockPayoutDetail} />);

      const cancelButton = screen.getByRole("button", { name: /cancel \/ hold/iu });
      fireEvent.click(cancelButton);

      expect(screen.getByRole("heading", { name: "Cancel Payout" })).toBeDefined();

      const confirmButton = screen.getByRole("button", { name: "Confirm Cancellation" });
      const reasonInput = screen.getByPlaceholderText(/state the administrative reason/iu);

      // Disabled when empty
      expect(confirmButton.hasAttribute("disabled")).toBe(true);

      fireEvent.change(reasonInput, { target: { value: "Creator under high dispute review" } });
      expect(confirmButton.hasAttribute("disabled")).toBe(false);

      fireEvent.click(confirmButton);

      expect(router.post).toHaveBeenCalledWith(
        "/admin/payouts/sp_101/cancel",
        { reason: "Creator under high dispute review" },
        expect.anything(),
      );
    });
  });
});
