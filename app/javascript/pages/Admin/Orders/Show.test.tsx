// @vitest-environment happy-dom
import { router } from "@inertiajs/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Show, { type OrderDetailProps } from "./Show";

vi.mock("@inertiajs/react", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@inertiajs/react")>();
  return {
    ...mod,
    router: {
      post: vi.fn(),
    },
    usePage: () => ({ url: "/admin/orders/ord_1001", props: {} }),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockOrderDetailProps: OrderDetailProps = {
  order: {
    id: "ord_1001",
    external_id_numeric: "40021",
    customer_email: "buyer@example.com",
    customer_name: "Jane Buyer",
    product_name: "Pro Masterclass",
    product_id: "prod_999",
    variant_name: "Deluxe Tier",
    seller: {
      id: "usr_555",
      name: "Top Educator",
      email: "educator@example.com",
    },
    amount_formatted: "$199.00",
    price_cents: 19900,
    currency: "USD",
    refunded_amount_formatted: null,
    status: "successful",
    refund_status: null,
    is_chargeback: false,
    chargeback_date: null,
    created_at: "2026-09-20T14:00:00Z",
    payment_processor: "stripe",
    transaction_id: "ch_3NabcXYZ123456",
    refunds: [],
    subscription: {
      id: "sub_123",
      is_active: true,
      status: "active",
      cancelled_at: null,
      failed_at: null,
      frequency: "monthly",
    },
    license: {
      id: "lic_456",
      serial: "ABCDE-12345-FGHIJ-67890",
      disabled: false,
    },
    gift: null,
    affiliate: {
      affiliate_user_email: "partner@example.com",
      affiliate_user_name: "Affiliate Pro",
      amount_formatted: "$20.00",
    },
    access: {
      has_download: true,
      download_url: "/d/token123",
      receipt_url: "https://arifdrop.com/receipts/ord_1001",
    },
  },
};

describe("Admin Order Detail (Show) Page", () => {
  it("renders comprehensive order information", () => {
    render(<Show {...mockOrderDetailProps} />);

    // Header & Order numbers
    expect(screen.getByRole("heading", { name: "Order #40021" })).toBeDefined();
    expect(screen.getByText("Back to orders")).toBeDefined();

    // Customer & Product
    expect(screen.getByText("buyer@example.com")).toBeDefined();
    expect(screen.getByText("Jane Buyer")).toBeDefined();
    expect(screen.getByText("Pro Masterclass")).toBeDefined();
    expect(screen.getByText(/Deluxe Tier/u)).toBeDefined();
    expect(screen.getByText("Top Educator")).toBeDefined();
    expect(screen.getByText("$199.00")).toBeDefined();

    // Payment details
    expect(screen.getByText("stripe")).toBeDefined();
    expect(screen.getByText("ch_3NabcXYZ123456")).toBeDefined();

    // License key
    expect(screen.getByText("ABCDE-12345-FGHIJ-67890")).toBeDefined();

    // Affiliate details
    expect(screen.getByText(/partner@example.com/u)).toBeDefined();
    expect(screen.getByText("$20.00")).toBeDefined();

    // Access links
    expect(screen.getByText("Access download page")).toBeDefined();
    expect(screen.getByText("View customer receipt")).toBeDefined();
  });

  it("handles resend receipt action", () => {
    render(<Show {...mockOrderDetailProps} />);

    const resendButton = screen.getByRole("button", { name: /resend receipt/iu });
    fireEvent.click(resendButton);

    expect(router.post).toHaveBeenCalledWith(
      "/admin/orders/ord_1001/resend_receipt",
      {},
      expect.objectContaining({ onFinish: expect.any(Function) }),
    );
  });

  describe("Refund Modal", () => {
    it("opens refund modal and displays order context and helper text", () => {
      render(<Show {...mockOrderDetailProps} />);

      const refundButton = screen.getByRole("button", { name: /refund order/iu });
      fireEvent.click(refundButton);

      expect(screen.getByRole("heading", { name: "Refund order" })).toBeDefined();
      expect(screen.getByText("Sent to the creator by email")).toBeDefined();
      expect(screen.getByText("$199.00 (Full)")).toBeDefined();
    });

    it("requires refund reason before submitting", () => {
      render(<Show {...mockOrderDetailProps} />);

      fireEvent.click(screen.getByRole("button", { name: /refund order/iu }));

      const confirmButton = screen.getByRole("button", { name: /confirm full refund/iu });
      expect(confirmButton.hasAttribute("disabled")).toBe(true);

      const textarea = screen.getByLabelText(/reason for refund/iu);
      fireEvent.change(textarea, { target: { value: "Customer requested cancellation within 24h" } });

      expect(confirmButton.hasAttribute("disabled")).toBe(false);

      fireEvent.click(confirmButton);

      expect(router.post).toHaveBeenCalledWith(
        "/admin/orders/ord_1001/refund",
        { reason: "Customer requested cancellation within 24h" },
        expect.objectContaining({ onFinish: expect.any(Function) }),
      );
    });
  });

  describe("Cancel Subscription Modal", () => {
    it("displays cancel subscription button only when subscription is active", () => {
      const { rerender } = render(<Show {...mockOrderDetailProps} />);
      expect(screen.getByRole("button", { name: /cancel subscription/iu })).toBeDefined();

      // When subscription is cancelled
      rerender(
        <Show
          {...mockOrderDetailProps}
          order={{
            ...mockOrderDetailProps.order,
            subscription: {
              id: "sub_123",
              is_active: false,
              status: "cancelled",
              cancelled_at: "2026-09-21T00:00:00Z",
              failed_at: null,
              frequency: "monthly",
            },
          }}
        />,
      );
      expect(screen.queryByRole("button", { name: /cancel subscription/iu })).toBeNull();
    });

    it("opens confirmation dialog and dispatches cancel_subscription", () => {
      render(<Show {...mockOrderDetailProps} />);

      fireEvent.click(screen.getByRole("button", { name: /cancel subscription/iu }));

      expect(screen.getByRole("heading", { name: "Cancel subscription" })).toBeDefined();
      expect(screen.getByText(/Are you sure you want to cancel the recurring subscription/iu)).toBeDefined();

      const confirmButton = screen.getByRole("button", { name: /confirm cancellation/iu });
      fireEvent.click(confirmButton);

      expect(router.post).toHaveBeenCalledWith(
        "/admin/orders/ord_1001/cancel_subscription",
        {},
        expect.objectContaining({ onFinish: expect.any(Function) }),
      );
    });
  });
});
