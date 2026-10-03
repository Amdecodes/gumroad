// @vitest-environment happy-dom
import { router } from "@inertiajs/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
});

import Show, { ProductShowProps } from "./Show";

vi.mock("@inertiajs/react", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@inertiajs/react");
  return {
    ...actual,
    router: {
      get: vi.fn(),
      post: vi.fn(),
    },
    usePage: () => ({
      url: "/admin/products/mastering-ts",
      props: {},
    }),
    Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
      <a href={href} className={className}>
        {children}
      </a>
    ),
  };
});

const defaultProps: ProductShowProps = {
  product: {
    id: "prod_1",
    permalink: "mastering-ts",
    name: "Mastering TypeScript",
    description: "A complete deep-dive course into TypeScript 5.",
    status: "published",
    is_published: true,
    price_cents: 4900,
    price_formatted: "$49.00",
    currency: "USD",
    preview_url: null,
    store_url: "https://gumroad.com/l/mastering-ts",
    created_at: "2026-09-01T12:00:00Z",
    is_licensed: true,
    files_count: 2,
    variants_count: 1,
    files: [
      {
        id: "file_1",
        display_name: "typescript-cheatsheet.pdf",
        extension: "pdf",
        size: 1048576,
      },
      {
        id: "file_2",
        display_name: "source-code.zip",
        extension: "zip",
        size: 5242880,
      },
    ],
  },
  creator: {
    id: "usr_alice",
    name: "Alice Designer",
    username: "alice",
    email: "alice@example.com",
    avatar_url: null,
    admin_path: "/admin/creators/alice",
  },
  metrics: {
    gross_sales_cents: 588000,
    gross_sales_formatted: "$5,880.00",
    units_sold: 120,
    refund_count: 2,
    refund_rate: 1.7,
    customer_count: 115,
  },
  audit_history: [
    {
      id: 1,
      action: "products.unpublish",
      actor_name: "Security Lead",
      response_status: 200,
      created_at: "2026-09-20T10:00:00Z",
      note: "Temporary takedown for investigation",
    },
  ],
};

describe("Admin Products Show Page", () => {
  it("renders product overview, metrics, and files", () => {
    render(<Show {...defaultProps} />);

    expect(screen.getByRole("heading", { name: "Mastering TypeScript" })).toBeDefined();
    expect(screen.getByText("$5,880.00")).toBeDefined();
    expect(screen.getByText("120")).toBeDefined();
    expect(screen.getByText("1.7%")).toBeDefined();
    expect(screen.getByText("typescript-cheatsheet.pdf")).toBeDefined();
    expect(screen.getByText("source-code.zip")).toBeDefined();
    expect(screen.getByText("Alice Designer")).toBeDefined();
    expect(screen.getByText("products.unpublish")).toBeDefined();
  });

  it("handles unpublish takedown workflow with reason note", () => {
    render(<Show {...defaultProps} />);

    const takedownBtn = screen.getByRole("button", { name: /Take Down \/ Unpublish/iu });
    fireEvent.click(takedownBtn);

    expect(screen.getByText(/Unpublish & Take Down Product/iu)).toBeDefined();

    const reasonInput = screen.getByLabelText(/reason note/iu);
    fireEvent.change(reasonInput, { target: { value: "Copyright dispute reported" } });

    const confirmBtn = screen.getByRole("button", { name: /Confirm Take Down/iu });
    fireEvent.click(confirmBtn);

    expect(router.post).toHaveBeenCalledWith(
      "/admin/products/mastering-ts/unpublish",
      expect.objectContaining({ reason: "Copyright dispute reported" }),
      expect.anything(),
    );
  });
});
