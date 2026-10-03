// @vitest-environment happy-dom
import { router } from "@inertiajs/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
});

import Index, { ProductsIndexProps } from "./Index";

vi.mock("@inertiajs/react", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@inertiajs/react");
  return {
    ...actual,
    router: {
      get: vi.fn(),
      post: vi.fn(),
    },
    usePage: () => ({
      url: "/admin/products",
      props: {},
    }),
    Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
      <a href={href} className={className}>
        {children}
      </a>
    ),
  };
});

const defaultProps: ProductsIndexProps = {
  products: [
    {
      id: "prod_1",
      permalink: "mastering-ts",
      name: "Mastering TypeScript",
      thumbnail_url: null,
      price_cents: 4900,
      price_formatted: "$49.00",
      sales_count: 120,
      lifetime_revenue_formatted: "$5,880.00",
      status: "published",
      created_at: "2026-09-01T12:00:00Z",
      creator: {
        id: "usr_alice",
        name: "Alice Designer",
        username: "alice",
        email: "alice@example.com",
        admin_path: "/admin/creators/alice",
      },
    },
    {
      id: "prod_2",
      permalink: "draft-book",
      name: "Unreleased Book",
      thumbnail_url: null,
      price_cents: 1500,
      price_formatted: "$15.00",
      sales_count: 0,
      lifetime_revenue_formatted: "$0.00",
      status: "draft",
      created_at: "2026-09-15T12:00:00Z",
      creator: {
        id: "usr_bob",
        name: "Bob Author",
        username: "bob",
        email: "bob@example.com",
        admin_path: "/admin/creators/bob",
      },
    },
  ],
  pagy: {
    page: 1,
    pages: 1,
    count: 2,
    next_page: null,
    prev_page: null,
    has_more: false,
  },
  filters: {},
};

describe("Admin Products Index Page", () => {
  it("renders table header and product rows", () => {
    render(<Index {...defaultProps} />);

    expect(screen.getByRole("heading", { name: /Products Management/iu })).toBeDefined();
    expect(screen.getByText("Mastering TypeScript")).toBeDefined();
    expect(screen.getByText("/mastering-ts")).toBeDefined();
    expect(screen.getByText("Alice Designer")).toBeDefined();
    expect(screen.getByText("$49.00")).toBeDefined();
    expect(screen.getAllByText("Published").length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText("Unreleased Book")).toBeDefined();
    expect(screen.getAllByText("Draft").length).toBeGreaterThanOrEqual(1);
  });

  it("submits search query and filters by status", () => {
    render(<Index {...defaultProps} />);

    const searchInput = screen.getByLabelText(/search products/iu);
    fireEvent.change(searchInput, { target: { value: "typescript" } });

    const statusSelect = screen.getByLabelText(/filter by status/iu);
    fireEvent.change(statusSelect, { target: { value: "published" } });

    const submitBtn = screen.getByRole("button", { name: /filter/iu });
    fireEvent.click(submitBtn);

    expect(router.get).toHaveBeenCalledWith(
      "/admin/products",
      expect.objectContaining({ q: "typescript", status: "published" }),
      expect.anything(),
    );
  });

  it("renders empty state when no products exist", () => {
    render(<Index {...defaultProps} products={[]} filters={{ q: "nonexistent" }} />);

    expect(screen.getByText(/no products found/iu)).toBeDefined();
    expect(screen.getByRole("button", { name: /clear filters/iu })).toBeDefined();
  });
});
