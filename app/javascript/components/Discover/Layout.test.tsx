// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CurrentSellerProvider } from "$app/components/CurrentSeller";
import { DomainSettingsProvider } from "$app/components/DomainSettings";
import * as breakpointModule from "$app/components/useIsAboveBreakpoint";
import { Layout } from "$app/components/Discover/Layout";

vi.stubGlobal("Routes", {
  discover_url: () => "/discover",
  discover_path: () => "/discover",
  library_url: () => "/library",
  products_url: () => "/products",
  login_url: () => "/login",
  signup_url: () => "/signup",
  dashboard_url: () => "/dashboard",
  cart_items_count_path: () => "/cart_items_count",
  cart_items_count_url: () => "/cart_items_count",
  cart_url: () => "/cart",
  cart_path: () => "/cart",
});

vi.mock("@inertiajs/react", async () => {
  const actual = await vi.importActual<typeof import("@inertiajs/react")>("@inertiajs/react");
  return {
    ...actual,
    usePage: () => ({ props: { autocomplete_results: null } }),
  };
});

const mockDomains = {
  scheme: "http",
  appDomain: "app.localhost",
  rootDomain: "localhost",
  shortDomain: "localhost",
  discoverDomain: "localhost",
  thirdPartyAnalyticsDomain: "localhost",
  apiDomain: "api.localhost",
};

describe("Discover Layout Header", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the LanguageToggle in the desktop buyer header", () => {
    vi.spyOn(breakpointModule, "useIsAboveBreakpoint").mockReturnValue(true);

    render(
      <CurrentSellerProvider value={null}>
        <DomainSettingsProvider value={mockDomains}>
          <Layout taxonomiesForNav={[]}>
            <div>Content</div>
          </Layout>
        </DomainSettingsProvider>
      </CurrentSellerProvider>,
    );

    const languageToggle = screen.getByRole("group", { name: /Language selection|ቋንቋ ምረጥ/i });
    expect(languageToggle).toBeTruthy();
    expect(screen.getByRole("button", { name: "EN" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "አማ" })).toBeTruthy();
  });

  it("renders the LanguageToggle in the mobile buyer header", () => {
    vi.spyOn(breakpointModule, "useIsAboveBreakpoint").mockReturnValue(false);

    render(
      <CurrentSellerProvider value={null}>
        <DomainSettingsProvider value={mockDomains}>
          <Layout taxonomiesForNav={[]}>
            <div>Content</div>
          </Layout>
        </DomainSettingsProvider>
      </CurrentSellerProvider>,
    );

    const languageToggle = screen.getByRole("group", { name: /Language selection|ቋንቋ ምረጥ/i });
    expect(languageToggle).toBeTruthy();
    expect(screen.getByRole("button", { name: "EN" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "አማ" })).toBeTruthy();
  });
});
