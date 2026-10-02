// @vitest-environment happy-dom
import { router } from "@inertiajs/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Order, { type OrderProps } from "./Order";

vi.mock("@inertiajs/react", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@inertiajs/react")>();
  return {
    ...mod,
    router: {
      post: vi.fn(),
    },
    usePage: () => ({ url: "/admin/orders/ord_ext_123", props: {} }),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockOrderProps: OrderProps = {
  order: {
    id: "ord_ext_123",
    external_id_numeric: "10042",
    customer_email: "customer@example.com",
    product_name: "Awesome Book",
    seller: {
      id: "seller_1",
      name: "Great Author",
      email: "author@example.com",
    },
    amount_formatted: "$15.00",
    price_cents: 1500,
    currency: "USD",
    status: "successful",
    created_at: "2026-09-02T12:00:00Z",
    refunds: [],
    access: {
      has_download: false,
    },
  },
};

describe("Admin Order Detail Page (re-export)", () => {
  it("renders order header and details", () => {
    render(<Order {...mockOrderProps} />);

    expect(screen.getByRole("heading", { name: "Order #10042" })).toBeDefined();
    expect(screen.getByText("customer@example.com")).toBeDefined();
    expect(screen.getByText("Awesome Book")).toBeDefined();
    expect(screen.getByText("Great Author")).toBeDefined();
    expect(screen.getByText("$15.00")).toBeDefined();
    expect(screen.getByText("successful")).toBeDefined();
  });

  it("triggers resend receipt when clicking the resend receipt button", () => {
    render(<Order {...mockOrderProps} />);

    const resendButton = screen.getByRole("button", { name: /resend receipt/iu });
    fireEvent.click(resendButton);

    expect(router.post).toHaveBeenCalledWith(
      "/admin/orders/ord_ext_123/resend_receipt",
      {},
      expect.objectContaining({ onFinish: expect.any(Function) }),
    );
  });
});
