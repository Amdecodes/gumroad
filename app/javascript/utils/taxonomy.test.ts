import { describe, expect, it } from "vitest";

import { taxonomyTranslationsAm } from "$app/locales/am/taxonomies";
import { taxonomyTranslationsEn } from "$app/locales/en/taxonomies";
import { setCurrentLocale } from "$app/utils/i18n";
import { getTaxonomyLabel } from "$app/utils/taxonomy";

describe("taxonomy localization", () => {
  it("translates known slugs according to current locale", () => {
    setCurrentLocale("en");
    expect(getTaxonomyLabel("3d")).toBe("3D");
    expect(getTaxonomyLabel("design")).toBe("Design");

    setCurrentLocale("am");
    expect(getTaxonomyLabel("3d")).toBe("3ዲ");
    expect(getTaxonomyLabel("design")).toBe("ንድፍ");
  });

  it("respects localeOverride when provided", () => {
    setCurrentLocale("en");
    expect(getTaxonomyLabel("3d", undefined, "am")).toBe("3ዲ");
    expect(getTaxonomyLabel("3d", undefined, "en")).toBe("3D");
  });

  it("falls back to fallback or DB slug for unknown slugs", () => {
    setCurrentLocale("am");
    expect(getTaxonomyLabel("unknown-slug", "Custom Fallback")).toBe("Custom Fallback");
    expect(getTaxonomyLabel("unknown-slug")).toBe("unknown-slug");
  });

  it("has an Amharic translation for every English taxonomy slug", () => {
    const missing = Object.keys(taxonomyTranslationsEn).filter((slug) => !taxonomyTranslationsAm[slug]);
    expect(missing).toEqual([]);
  });
});
