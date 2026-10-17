import { taxonomyTranslationsAm } from "$app/locales/am/taxonomies";
import { taxonomyTranslationsEn } from "$app/locales/en/taxonomies";
import { resolveCurrentLocale } from "$app/utils/i18n";

export const TAXONOMY_TRANSLATIONS: Record<"en" | "am", Record<string, string>> = {
  en: taxonomyTranslationsEn,
  am: taxonomyTranslationsAm,
};

export function getTaxonomyLabel(
  slug: string | null | undefined,
  fallback?: string | null,
  localeOverride?: string,
): string {
  if (!slug) return fallback ?? "";
  const locale = localeOverride ?? resolveCurrentLocale();
  if (locale === "am" && TAXONOMY_TRANSLATIONS.am[slug]) {
    return TAXONOMY_TRANSLATIONS.am[slug];
  }
  if (locale === "en" && TAXONOMY_TRANSLATIONS.en[slug]) {
    return TAXONOMY_TRANSLATIONS.en[slug];
  }
  return fallback ?? TAXONOMY_TRANSLATIONS.en[slug] ?? slug;
}
