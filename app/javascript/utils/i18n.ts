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
  try {
    const page = usePage<{ locale?: string }>();
    const pageLocale = page.props.locale;
    if (pageLocale && isSupportedLocale(pageLocale)) {
      return pageLocale;
    }
  } catch {
    // Outside Inertia page context
  }
  return getCookieLocale();
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

export const translate = (
  key: string,
  locale: SupportedLocale = "en",
  params?: Record<string, string | number>,
  fallback?: string,
): string => {
  const dict = dictionaries[locale];
  let text = getNestedValue(dict, key);

  if (typeof text !== "string") {
    // Fallback to English dictionary
    text = getNestedValue(dictionaries.en, key);
  }

  if (typeof text !== "string") {
    return fallback ?? key;
  }

  if (params) {
    return text.replace(/\{(\w+)\}/gu, (_, placeholder: string) => {
      if (Object.prototype.hasOwnProperty.call(params, placeholder)) {
        return String(params[placeholder]);
      }
      return `{${placeholder}}`;
    });
  }

  return text;
};

export const t = (key: string, params?: Record<string, string | number>, fallback?: string): string => {
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
    (key: string, params?: Record<string, string | number>, fallback?: string) =>
      translate(key, locale, params, fallback),
    [locale],
  );

  return {
    t: translateWithCurrentLocale,
    locale,
    switchLocale,
  };
};
