import { usePage } from "@inertiajs/react";
import * as React from "react";

import { am } from "$app/locales/am";
import { en } from "$app/locales/en";

export type SupportedLocale = "en" | "am";

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ["en", "am"];

export const isSupportedLocale = (val: string): val is SupportedLocale => val === "en" || val === "am";

const dictionaries: Record<SupportedLocale, Record<string, unknown>> = {
  en,
  am,
};

export const getCookieLocale = (): SupportedLocale => {
  if (typeof document === "undefined") return "en";
  const match = /(?:^|;\s*)locale=([^;]+)/u.exec(document.cookie);
  if (match) {
    const val = match[1] ?? "";
    if (isSupportedLocale(val)) {
      return val;
    }
  }
  return "en";
};

export const resolveCurrentLocale = (): SupportedLocale => {
  if (typeof document !== "undefined") {
    const match = /(?:^|;\s*)locale=([^;]+)/u.exec(document.cookie);
    if (match) {
      const val = match[1] ?? "";
      if (isSupportedLocale(val)) {
        return val;
      }
    }
    const lang = document.documentElement.lang;
    if (isSupportedLocale(lang)) {
      return lang;
    }
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
  return translate(key, locale, params, fallback);
};

export const switchLocale = async (newLocale: string): Promise<void> => {
  if (!isSupportedLocale(newLocale)) return;

  if (typeof document !== "undefined") {
    document.cookie = `locale=${newLocale};path=/;max-age=31536000;SameSite=Lax`;
    document.documentElement.lang = newLocale;
  }

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

  if (typeof window !== "undefined") {
    window.location.reload();
  }
};

export const useTranslation = () => {
  let locale: SupportedLocale = "en";
  try {
    const page = usePage<{ locale?: string }>();
    const pageLocale = page.props.locale;
    if (pageLocale && isSupportedLocale(pageLocale)) {
      locale = pageLocale;
    } else {
      locale = getCookieLocale();
    }
  } catch {
    locale = getCookieLocale();
  }

  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
      if (locale === "am") {
        document.documentElement.classList.add("lang-am");
      } else {
        document.documentElement.classList.remove("lang-am");
      }
    }
  }, [locale]);

  const translateWithCurrentLocale = React.useCallback(
    (
      key: string,
      params?: Record<string, string | number> | string,
      fallback?: string | Record<string, string | number>,
    ) => translate(key, locale, params, fallback),
    [locale],
  );

  return {
    t: translateWithCurrentLocale,
    locale,
    switchLocale,
  };
};
