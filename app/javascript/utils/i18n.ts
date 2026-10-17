import { usePage } from "@inertiajs/react";
import * as React from "react";

import { am } from "$app/locales/am";
import { en } from "$app/locales/en";

export type SupportedLocale = "en" | "am";

// Includes 'pseudo' for non-production locale verification workflows.
export type ActiveLocale = SupportedLocale | "pseudo";

export const PSEUDO_LOCALE = "pseudo" as const;

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ["en", "am"];

export const isSupportedLocale = (val: string): val is SupportedLocale => val === "en" || val === "am";

// Only true outside of production builds.
export const isPseudoLocale = (val: string): boolean => val === PSEUDO_LOCALE && import.meta.env.PROD !== true;

const dictionaries: Record<SupportedLocale, Record<string, unknown>> = {
  en,
  am,
};

let currentServerLocale: ActiveLocale | null = null;
let currentCookieDomain: string | null = null;

export const setCurrentLocale = (loc: ActiveLocale | null) => {
  currentServerLocale = loc;
};

export const resetCurrentLocaleForTesting = () => {
  currentServerLocale = null;
  currentCookieDomain = null;
  if (typeof document !== "undefined") {
    document.documentElement.lang = "";
  }
};

export const getCookieLocale = (): ActiveLocale => {
  if (typeof document === "undefined") return "en";
  const match = /(?:^|;\s*)locale=([^;]+)/u.exec(document.cookie);
  if (match) {
    const val = match[1] ?? "";
    if (isPseudoLocale(val)) return PSEUDO_LOCALE;
    if (isSupportedLocale(val)) return val;
  }
  return "en";
};

export const getSharedCookieDomain = (): string | null => {
  if (currentCookieDomain) return currentCookieDomain;
  if (typeof document === "undefined") return null;
  try {
    const appEl = document.getElementById("app");
    if (appEl?.dataset?.page) {
      const parsed = JSON.parse(appEl.dataset.page);
      return parsed.props?.cookie_domain || null;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
};

export const resolveCurrentLocale = (): ActiveLocale => {
  if (currentServerLocale && (isSupportedLocale(currentServerLocale) || isPseudoLocale(currentServerLocale))) {
    return currentServerLocale;
  }
  if (typeof document !== "undefined") {
    try {
      const appEl = document.getElementById("app");
      if (appEl?.dataset?.page) {
        const parsed = JSON.parse(appEl.dataset.page);
        const pageLoc = parsed.props?.locale;
        if (pageLoc && isPseudoLocale(pageLoc)) {
          return PSEUDO_LOCALE;
        }
        if (pageLoc && isSupportedLocale(pageLoc)) {
          return pageLoc;
        }
      }
    } catch {
      // Ignore
    }

    const match = /(?:^|;\s*)locale=([^;]+)/u.exec(document.cookie);
    if (match) {
      const val = match[1] ?? "";
      if (isPseudoLocale(val)) return PSEUDO_LOCALE;
      if (isSupportedLocale(val)) return val;
    }

    const lang = document.documentElement.lang;
    if (isPseudoLocale(lang)) return PSEUDO_LOCALE;
    if (isSupportedLocale(lang)) return lang;
  }
  return "en";
};

const isObject = (val: unknown): val is Record<string, unknown> => typeof val === "object" && val !== null;

const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (isObject(current) && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return current;
};

const resolvePluralCandidate = (val: unknown, count?: number): unknown => {
  if (isObject(val) && ("one" in val || "other" in val)) {
    if (count !== undefined) {
      if (count === 1 && "one" in val && typeof val.one === "string") {
        return val.one;
      }
      if ("other" in val && typeof val.other === "string") {
        return val.other;
      }
      if ("one" in val && typeof val.one === "string") {
        return val.one;
      }
    }
  }
  return val;
};

export const DEFAULT_PLATFORM_PARAMS: Record<SupportedLocale, Record<string, string>> = {
  en: {
    app_name: "ArifDrop",
    appName: "ArifDrop",
    support_email: "support@arifdrop.com",
    supportEmail: "support@arifdrop.com",
    statement_descriptor: "ARIFDROP*",
    statementDescriptor: "ARIFDROP*",
    kindle_email: "noreply@customers.arifdrop.com",
    kindleEmail: "noreply@customers.arifdrop.com",
  },
  am: {
    app_name: "አሪፍድሮፕ",
    appName: "አሪፍድሮፕ",
    support_email: "support@arifdrop.com",
    supportEmail: "support@arifdrop.com",
    statement_descriptor: "ARIFDROP*",
    statementDescriptor: "ARIFDROP*",
    kindle_email: "noreply@customers.arifdrop.com",
    kindleEmail: "noreply@customers.arifdrop.com",
  },
};

// Maps ASCII vowels to their accented equivalents for pseudo-locale simulation.
const VOWEL_ACCENTS: Record<string, string> = {
  a: "á",
  e: "é",
  i: "í",
  o: "ó",
  u: "ú",
  A: "Á",
  E: "É",
  I: "Í",
  O: "Ó",
  U: "Ú",
};

// Replaces vowels with accented equivalents, then pads to ~130% of original length.
const pseudoExpand = (text: string): string => {
  const accented = text.replace(/[aeiouAEIOU]/gu, (c) => VOWEL_ACCENTS[c] ?? c);
  const targetLen = Math.ceil(text.length * 1.3);
  const pad = "ẋ".repeat(Math.max(0, targetLen - accented.length));
  return accented + pad;
};

// Applies parameter substitution against the English dictionary, then wraps in ⟦…⟧ with pseudo-expansion.
const pseudoTranslate = (
  key: string,
  params?: Record<string, string | number> | string,
  fallback?: string | Record<string, string | number>,
): string => {
  // Resolve the English text first (reuse translate with 'en').
  const englishText = translate(key, "en", params, fallback);
  return `\u27E6${pseudoExpand(englishText)}\u27E7`;
};

export const translate = (
  key: string,
  locale: SupportedLocale = "en",
  params?: Record<string, string | number> | string,
  fallback?: string | Record<string, string | number>,
): string => {
  let actualParams: Record<string, string | number> | undefined;
  let actualFallback: string | undefined;

  if (typeof params === "string") {
    actualFallback = params;
    if (typeof fallback === "object") {
      actualParams = fallback;
    }
  } else {
    if (typeof params === "object") {
      actualParams = params;
    }
    if (typeof fallback === "string") {
      actualFallback = fallback;
    }
  }

  const dict = dictionaries[locale];
  const rawValue = getNestedValue(dict, key);

  let countNum: number | undefined;
  if (actualParams?.count !== undefined) {
    const parsed = typeof actualParams.count === "number" ? actualParams.count : Number(actualParams.count);
    if (!Number.isNaN(parsed)) {
      countNum = parsed;
    }
  }

  let text = resolvePluralCandidate(rawValue, countNum);

  if (typeof text !== "string") {
    // Fallback to English dictionary
    const fallbackRaw = getNestedValue(dictionaries.en, key);
    text = resolvePluralCandidate(fallbackRaw, countNum);
  }

  const resolvedText = typeof text === "string" ? text : (actualFallback ?? key);

  const effectiveParams = {
    ...DEFAULT_PLATFORM_PARAMS[locale],
    ...(actualParams ?? {}),
  };

  return resolvedText.replace(/%?\{(\w+)\}/gu, (_, placeholder: string) => {
    if (Object.prototype.hasOwnProperty.call(effectiveParams, placeholder)) {
      return String(effectiveParams[placeholder]);
    }
    return `{${placeholder}}`;
  });
};

export type TFunction = (
  key: string,
  params?: Record<string, string | number> | string,
  fallback?: string | Record<string, string | number>,
) => string;

export const t: TFunction = (
  key: string,
  params?: Record<string, string | number> | string,
  fallback?: string | Record<string, string | number>,
): string => {
  const locale = resolveCurrentLocale();
  if (locale === PSEUDO_LOCALE) return pseudoTranslate(key, params, fallback);
  return translate(key, locale, params, fallback);
};

export const switchLocale = async (newLocale: string, domain?: string | null): Promise<void> => {
  // Allow 'pseudo' only in non-production environments.
  const isAllowed = isSupportedLocale(newLocale) || isPseudoLocale(newLocale);
  if (!isAllowed) return;

  const resolvedDomain = domain !== undefined ? domain : getSharedCookieDomain();

  if (typeof document !== "undefined") {
    let cookieVal = `locale=${newLocale};path=/;max-age=31536000;SameSite=Lax`;
    if (resolvedDomain) {
      cookieVal += `;domain=${resolvedDomain}`;
    }
    document.cookie = cookieVal;
    document.documentElement.lang = newLocale;
  }

  currentServerLocale = newLocale as ActiveLocale;

  // Only POST to server for real (server-persisted) locales; pseudo is client-only.
  if (isSupportedLocale(newLocale)) {
    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
      await fetch("/locale", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: JSON.stringify({ locale: newLocale }),
      });
    } catch {
      // Fall back to reload
    }
  }

  if (typeof window !== "undefined" && window.location) {
    try {
      const href = window.location.href;
      if (href && (href.startsWith("http://") || href.startsWith("https://"))) {
        const url = new URL(href);
        if (url.searchParams.has("locale")) {
          url.searchParams.set("locale", newLocale);
          window.location.href = url.toString();
          return;
        }
      }
    } catch {
      // Ignore
    }

    if (typeof window.location.reload === "function") {
      window.location.reload();
    }
  }
};

export const useTranslation = () => {
  let locale: ActiveLocale = "en";
  let cookieDomain: string | null = currentCookieDomain;
  let hasInertiaLocale = false;

  try {
    const page = usePage<{ locale?: string; cookie_domain?: string | null }>();
    const pageLocale = page.props?.locale;
    if (pageLocale && isPseudoLocale(pageLocale)) {
      locale = PSEUDO_LOCALE;
      hasInertiaLocale = true;
    } else if (pageLocale && isSupportedLocale(pageLocale)) {
      locale = pageLocale;
      hasInertiaLocale = true;
    }
    if (page.props?.cookie_domain !== undefined) {
      cookieDomain = page.props.cookie_domain || null;
      currentCookieDomain = cookieDomain;
    }
  } catch {
    // outside Inertia page context
  }

  if (hasInertiaLocale) {
    currentServerLocale = locale;
  } else {
    locale = resolveCurrentLocale();
  }

  // Use the resolved SupportedLocale for DOM class/attr effects; pseudo behaves like 'en' visually.
  const domLocale: SupportedLocale = locale === PSEUDO_LOCALE ? "en" : locale;

  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
      if (domLocale === "am") {
        document.documentElement.classList.add("lang-am");
      } else {
        document.documentElement.classList.remove("lang-am");
      }
    }
  }, [locale, domLocale]);

  const translateWithCurrentLocale = React.useCallback(
    (
      key: string,
      params?: Record<string, string | number> | string,
      fallback?: string | Record<string, string | number>,
    ) => {
      if (locale === PSEUDO_LOCALE) return pseudoTranslate(key, params, fallback);
      return translate(key, locale, params, fallback);
    },
    [locale],
  );

  const boundSwitchLocale = React.useCallback(
    (newLocale: string) => switchLocale(newLocale, cookieDomain),
    [cookieDomain],
  );

  return {
    t: translateWithCurrentLocale,
    locale,
    switchLocale: boundSwitchLocale,
  };
};

export const useTranslate = useTranslation;
