// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageToggle } from "$app/components/LanguageToggle";
import { resetCurrentLocaleForTesting, setCurrentLocale, useTranslation } from "$app/utils/i18n";

describe("LanguageToggle", () => {
  beforeEach(() => {
    resetCurrentLocaleForTesting();
    document.cookie = "locale=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders both EN and አማ toggle buttons", () => {
    render(<LanguageToggle />);

    expect(screen.getByRole("group", { name: "Language selection" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "EN" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "አማ" })).toBeTruthy();
  });

  it("indicates EN as active when locale is English", () => {
    document.cookie = "locale=en; path=/";
    render(<LanguageToggle />);

    const enButton = screen.getByRole("button", { name: "EN" });
    const amButton = screen.getByRole("button", { name: "አማ" });

    expect(enButton.getAttribute("aria-pressed")).toBe("true");
    expect(amButton.getAttribute("aria-pressed")).toBe("false");
  });

  it("indicates አማ as active when locale is Amharic", () => {
    document.cookie = "locale=am; path=/";
    render(<LanguageToggle />);

    const enButton = screen.getByRole("button", { name: "EN" });
    const amButton = screen.getByRole("button", { name: "አማ" });

    expect(enButton.getAttribute("aria-pressed")).toBe("false");
    expect(amButton.getAttribute("aria-pressed")).toBe("true");
  });

  it("switches language when clicking the alternative language", () => {
    document.cookie = "locale=en; path=/";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true, locale: "am" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      writable: true,
      value: { reload: reloadMock },
    });

    render(<LanguageToggle />);

    const amButton = screen.getByRole("button", { name: "አማ" });
    act(() => {
      fireEvent.click(amButton);
    });

    expect(document.cookie).toContain("locale=am");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/locale",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ locale: "am" }),
      }),
    );
  });

  it("does not trigger locale switch when clicking the currently active language", () => {
    document.cookie = "locale=en; path=/";
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(<LanguageToggle />);

    const enButton = screen.getByRole("button", { name: "EN" });
    act(() => {
      fireEvent.click(enButton);
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("applies dark variant classes when variant='dark'", () => {
    render(<LanguageToggle variant="dark" />);

    const container = screen.getByRole("group", { name: "Language selection" });
    expect(container.className).toContain("bg-black/40");
    expect(container.className).toContain("text-white/80");
  });

  it("ensures toggle and translations read the same source", () => {
    setCurrentLocale("am");
    const ConsumerComponent = () => {
      const { t } = useTranslation();
      return (
        <div>
          <LanguageToggle />
          <span data-testid="translated">{t("auth.log_in")}</span>
        </div>
      );
    };

    render(<ConsumerComponent />);

    const amButton = screen.getByRole("button", { name: "አማ" });
    const enButton = screen.getByRole("button", { name: "EN" });
    expect(amButton.getAttribute("aria-pressed")).toBe("true");
    expect(enButton.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByTestId("translated").textContent).toBe("ግባ");
  });
});
