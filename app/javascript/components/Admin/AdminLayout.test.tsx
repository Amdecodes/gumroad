// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useCurrentSeller } from "$app/components/CurrentSeller";
import { useLoggedInUser } from "$app/components/LoggedInUser";
import * as alertModule from "$app/components/server-components/Alert";

import { AdminLayout } from "./AdminLayout";

let mockPageProps: Record<string, unknown> = {};

vi.mock("@inertiajs/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@inertiajs/react")>();
  return {
    ...actual,
    router: {
      get: vi.fn(),
      post: vi.fn(),
      replaceProp: vi.fn(),
    },
    usePage: () => ({
      url: "/admin",
      props: mockPageProps,
    }),
    Link: ({
      children,
      href,
      className,
      onClick,
    }: {
      children: React.ReactNode;
      href: string;
      className?: string;
      onClick?: () => void;
    }) => (
      <a href={href} className={className} onClick={onClick}>
        {children}
      </a>
    ),
  };
});

afterEach(() => {
  cleanup();
  mockPageProps = {};
  vi.clearAllMocks();
});

const ConsumerTestComponent = () => {
  const user = useLoggedInUser();
  const seller = useCurrentSeller();

  return (
    <div>
      <div data-testid="user-info">{user ? `User: ${user.name} (${user.email})` : "No user"}</div>
      <div data-testid="seller-info">{seller ? `Seller: ${seller.name} (${seller.id})` : "No seller"}</div>
    </div>
  );
};

describe("AdminLayout", () => {
  it("mounts LoggedInUserProvider and CurrentSellerProvider providing context to children", () => {
    mockPageProps = {
      logged_in_user: {
        id: "usr_admin1",
        email: "admin@example.com",
        name: "Admin User",
        avatar_url: "/avatar.png",
        confirmed: true,
        team_memberships: [],
        can_create_brand_account: false,
        has_payout_setup_to_port: false,
        can_port_bank_payout_setup: false,
        will_copy_bank_payout: false,
        policies: {
          affiliate_requests_onboarding_form: { update: false },
          direct_affiliate: { create: false, update: false },
          collaborator: { create: false, update: false },
          product: { create: false },
          product_review_response: { update: false },
          balance: { index: false, export: false },
          checkout_offer_code: { create: false },
          checkout_form: { update: false },
          upsell: { create: false },
          settings_payments_user: { show: false },
          settings_main_user: { update_username: false },
          settings_profile: { manage_social_connections: false, update: false },
          settings_third_party_analytics_user: { update: false },
          installment: { create: false },
          workflow: { create: false },
          utm_link: { index: false },
          community: { index: false },
          churn: { show: false },
          page: { index: false, create: false },
          user: { view_store_agent: false, use_store_agent: false },
        },
        promoted_nav_items: [],
        lazy_load_offscreen_discover_images: false,
      },
      current_seller: {
        id: "usr_admin1",
        email: "admin@example.com",
        name: "Admin Store",
        subdomain: "admin-store",
        avatar_url: "/avatar.png",
        is_buyer: false,
        time_zone: { name: "UTC", offset: 0 },
        has_published_products: true,
        can_publish_products: true,
        publish_blocked_reason: null,
        no_payout_rail_in_compliance_country: false,
        legal_guardian_requirement_met: true,
        legal_guardian_unsupported: false,
        is_name_invalid_for_email_delivery: false,
        profile_background_color: "#ffffff",
        profile_highlight_color: "#000000",
        profile_font: "sans-serif",
      },
    };

    render(
      <AdminLayout>
        <ConsumerTestComponent />
      </AdminLayout>,
    );

    expect(screen.getByTestId("user-info").textContent).toBe("User: Admin User (admin@example.com)");
    expect(screen.getByTestId("seller-info").textContent).toBe("Seller: Admin Store (usr_admin1)");
  });

  it("safely handles null logged_in_user and current_seller without assertion errors", () => {
    mockPageProps = {
      logged_in_user: null,
      current_seller: null,
    };

    render(
      <AdminLayout>
        <ConsumerTestComponent />
      </AdminLayout>,
    );

    expect(screen.getByTestId("user-info").textContent).toBe("No user");
    expect(screen.getByTestId("seller-info").textContent).toBe("No seller");
  });

  it("handles h-dvh and shell scrolling structure", () => {
    render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>,
    );

    const main = document.querySelector("main");
    expect(main).not.toBeNull();
    expect(main?.getAttribute("scroll-region")).toBe("");
    expect(main?.className).toContain("overflow-y-auto");

    const shell = main?.closest(".h-dvh");
    expect(shell).not.toBeNull();
    expect(shell?.className).toContain("overflow-hidden");
  });

  it("triggers flash message alert when flash prop is present", () => {
    const showAlertSpy = vi.spyOn(alertModule, "showAlert").mockImplementation(() => {});

    mockPageProps = {
      flash: {
        message: "Settings saved successfully",
        status: "success",
      },
    };

    render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>,
    );

    expect(showAlertSpy).toHaveBeenCalledWith("Settings saved successfully", "success");
  });

  it("toggles mobile sidebar drawer via header button and close button", () => {
    render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>,
    );

    const sidebar = screen.getByRole("complementary", { name: /admin navigation/iu });
    expect(sidebar.className).toContain("-translate-x-full");

    const openButton = screen.getByRole("button", { name: /open navigation/iu });
    fireEvent.click(openButton);

    expect(sidebar.className).toContain("translate-x-0");

    const closeButton = screen.getByRole("button", { name: /close navigation/iu });
    fireEvent.click(closeButton);

    expect(sidebar.className).toContain("-translate-x-full");
  });
});
