// @vitest-environment happy-dom
import { router } from "@inertiajs/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Index, { type CreatorsIndexProps, type CreatorSummary } from "./Index";

vi.mock("@inertiajs/react", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@inertiajs/react")>();
  return {
    ...mod,
    router: {
      get: vi.fn(),
      post: vi.fn(),
    },
    usePage: () => ({ url: "/admin/creators", props: {} }),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockCreators: CreatorSummary[] = [
  {
    external_id: "usr_1",
    username: "alice",
    display_name: "Alice Designer",
    email: "alice@example.com",
    avatar_url: "/avatars/alice.png",
    product_count: 5,
    total_sales_count: 42,
    formatted_lifetime_volume: "$2,100.00",
    status: "active",
    joined_at: "2026-08-10T12:00:00Z",
  },
  {
    external_id: "usr_2",
    username: "bob",
    display_name: "Bob Dev",
    email: "bob@example.com",
    avatar_url: "/avatars/bob.png",
    product_count: 1,
    total_sales_count: 10,
    formatted_lifetime_volume: "$500.00",
    status: "suspended",
    joined_at: "2026-07-01T10:00:00Z",
  },
];

const defaultProps: CreatorsIndexProps = {
  creators: mockCreators,
  pagy: {
    page: 1,
    pages: 2,
    count: 35,
    has_more: true,
  },
  filters: {
    q: "",
    status: "",
  },
};

describe("Admin Creators Index Page", () => {
  it("renders page header and creators table with correct data", () => {
    render(<Index {...defaultProps} />);

    expect(screen.getByRole("heading", { name: /creators/iu })).toBeDefined();
    expect(screen.getByText(/manage creator accounts/iu)).toBeDefined();

    // Alice row
    expect(screen.getByText("Alice Designer")).toBeDefined();
    expect(screen.getByText("@alice")).toBeDefined();
    expect(screen.getByText("alice@example.com")).toBeDefined();
    expect(screen.getByText("$2,100.00")).toBeDefined();
    expect(screen.getAllByText("Active").length).toBeGreaterThanOrEqual(1);

    // Bob row
    expect(screen.getByText("Bob Dev")).toBeDefined();
    expect(screen.getByText("@bob")).toBeDefined();
    expect(screen.getByText("bob@example.com")).toBeDefined();
    expect(screen.getByText("$500.00")).toBeDefined();
    expect(screen.getAllByText("Suspended").length).toBeGreaterThanOrEqual(1);
  });

  it("renders empty state when there are no creators", () => {
    render(<Index {...defaultProps} creators={[]} pagy={{ page: 1, pages: 1, count: 0, has_more: false }} />);

    expect(screen.getByText("No creators found")).toBeDefined();
    expect(screen.getByText(/try adjusting your search criteria/iu)).toBeDefined();
  });

  it("submits search query with router.get", () => {
    render(<Index {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/search by name, @username, or email/iu);
    fireEvent.change(searchInput, { target: { value: "alice" } });

    const searchForm = searchInput.closest("form");
    expect(searchForm).not.toBeNull();
    if (searchForm) {
      fireEvent.submit(searchForm);
    }

    expect(router.get).toHaveBeenCalledWith(
      "/admin/creators",
      { q: "alice" },
      expect.objectContaining({ preserveState: true, preserveScroll: true }),
    );
  });

  it("triggers filter on status change", () => {
    render(<Index {...defaultProps} />);

    const statusSelect = screen.getByLabelText(/status filter/iu);
    fireEvent.change(statusSelect, { target: { value: "suspended" } });

    expect(router.get).toHaveBeenCalledWith(
      "/admin/creators",
      { status: "suspended" },
      expect.objectContaining({ preserveState: true, preserveScroll: true }),
    );
  });

  it("clears filters when clicking the reset button", () => {
    render(<Index {...defaultProps} filters={{ q: "bob", status: "suspended" }} />);

    const resetButton = screen.getByRole("button", { name: /reset/iu });
    fireEvent.click(resetButton);

    expect(router.get).toHaveBeenCalledWith(
      "/admin/creators",
      {},
      expect.objectContaining({ preserveState: true, preserveScroll: true }),
    );
  });
});
