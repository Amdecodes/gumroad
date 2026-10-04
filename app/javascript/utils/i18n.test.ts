// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SUPPORTED_LOCALES, getCookieLocale, translate, switchLocale, useTranslation } from "$app/utils/i18n";

describe("i18n utility", () => {
  const clearCookie = () => {
    document.cookie = "locale=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    document.cookie = "locale=; max-age=0; path=/";
  };

  beforeEach(() => {
    clearCookie();
    document.documentElement.lang = "en";
    document.documentElement.classList.remove("lang-am");
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearCookie();
    document.documentElement.lang = "en";
    document.documentElement.classList.remove("lang-am");
    vi.restoreAllMocks();
  });

  describe("SUPPORTED_LOCALES", () => {
    it("strictly supports English (en) and Amharic (am) only", () => {
      expect(SUPPORTED_LOCALES).toEqual(["en", "am"]);
      expect(SUPPORTED_LOCALES).toHaveLength(2);
    });
  });

  describe("getCookieLocale", () => {
    it("defaults to en when no cookie is set", () => {
      expect(getCookieLocale()).toBe("en");
    });

    it("parses am when cookie contains locale=am", () => {
      document.cookie = "locale=am; path=/";
      expect(getCookieLocale()).toBe("am");
    });

    it("parses en when cookie contains locale=en", () => {
      document.cookie = "locale=en; path=/";
      expect(getCookieLocale()).toBe("en");
    });

    it("falls back to en when cookie contains an unsupported locale", () => {
      document.cookie = "locale=fr; path=/";
      expect(getCookieLocale()).toBe("en");
    });
  });

  describe("translate", () => {
    it("translates common keys into English by default", () => {
      expect(translate("actions.save", "en")).toBe("Save");
      expect(translate("actions.pay", "en")).toBe("Pay");
      expect(translate("currency.code", "en")).toBe("ETB");
      expect(translate("currency.minor_unit", "en")).toBe("santim");
      expect(translate("checkout.title", "en")).toBe("Checkout");
      expect(translate("subscriptions.statuses.active", "en")).toBe("Active");
      expect(translate("admin.overview", "en")).toBe("Overview");
    });

    it("translates common keys into Amharic when locale is am", () => {
      expect(translate("actions.save", "am")).toBe("አስቀምጥ");
      expect(translate("actions.pay", "am")).toBe("ክፈል");
      expect(translate("currency.code", "am")).toBe("ብር");
      expect(translate("currency.minor_unit", "am")).toBe("ሳንቲም");
      expect(translate("checkout.title", "am")).toBe("ክፍያ መፈጸሚያ");
      expect(translate("subscriptions.statuses.active", "am")).toBe("ንቁ");
      expect(translate("admin.overview", "am")).toBe("አጠቃላይ እይታ");
    });

    it("replaces parameters in translation strings", () => {
      const enResult = translate("subscriptions.renew_now_for", "en", { price: "ETB 250.00" });
      expect(enResult).toBe("Renew now for ETB 250.00");

      const amResult = translate("subscriptions.renew_now_for", "am", { price: "ETB 250.00" });
      expect(amResult).toBe("በETB 250.00 አሁኑኑ ያድሱ");
    });

    it("replaces multiple parameters properly", () => {
      const result = translate("subscriptions.grace_period_warning", "am", {
        days: 3,
      });
      expect(result).toBe("ምዝገባዎ በማራዘሚያ ጊዜ ውስጥ ነው (ቀሪ 3 ቀናት)። ያልተቋረጠ መዳረሻ ለማግኘት አሁኑኑ ያድሱ።");
    });

    it("falls back to English when a key is missing in Amharic", () => {
      const result = translate("nonexistent.nested.key", "am", undefined, "Default Fallback");
      expect(result).toBe("Default Fallback");
    });

    it("falls back to the key name if no fallback is provided and key is missing", () => {
      expect(translate("unknown.key", "en")).toBe("unknown.key");
    });
  });

  describe("switchLocale", () => {
    it("ignores unsupported locales without changing cookie", async () => {
      clearCookie();
      await switchLocale("fr");
      expect(document.cookie).not.toContain("locale=fr");
    });

    it("updates document cookie and html lang attribute", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, locale: "am" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      // Prevent jsdom/happy-dom reload error
      const reloadMock = vi.fn();
      Object.defineProperty(window, "location", {
        writable: true,
        value: { reload: reloadMock },
      });

      await switchLocale("am");

      expect(document.cookie).toContain("locale=am");
      expect(document.documentElement.lang).toBe("am");
      expect(fetchSpy).toHaveBeenCalledWith(
        "/locale",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ locale: "am" }),
        }),
      );
      expect(reloadMock).toHaveBeenCalled();
    });
  });

  describe("useTranslation hook", () => {
    it("provides the translate function, current locale, and sets html lang", () => {
      document.cookie = "locale=am; path=/";

      const { result } = renderHook(() => useTranslation());

      expect(result.current.locale).toBe("am");
      expect(result.current.t("actions.pay")).toBe("ክፈል");
      expect(document.documentElement.lang).toBe("am");
      expect(document.documentElement.classList.contains("lang-am")).toBe(true);
    });

    it("removes lang-am class when locale is English", () => {
      document.cookie = "locale=en; path=/";

      const { result } = renderHook(() => useTranslation());

      expect(result.current.locale).toBe("en");
      expect(result.current.t("actions.pay")).toBe("Pay");
      expect(document.documentElement.lang).toBe("en");
      expect(document.documentElement.classList.contains("lang-am")).toBe(false);
    });
  });
});
