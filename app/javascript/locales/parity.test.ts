import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";
import * as yaml from "yaml";

import { translate } from "$app/utils/i18n";

import { am } from "./am";
import { en } from "./en";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const getDeepKeys = (obj: Record<string, unknown>, prefix = ""): string[] => {
  let keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (isRecord(v)) {
      keys = keys.concat(getDeepKeys(v, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
};

describe("Locale Parity", () => {
  it("maintains strict key parity between TypeScript en and am dictionaries", () => {
    const enObj: Record<string, unknown> = en;
    const amObj: Record<string, unknown> = am;
    const enKeys = getDeepKeys(enObj);
    const amKeys = getDeepKeys(amObj);

    const missingInAm = enKeys.filter((k) => !amKeys.includes(k));
    const extraInAm = amKeys.filter((k) => !enKeys.includes(k));

    expect(missingInAm, "Keys present in en but missing in am").toEqual([]);
    expect(extraInAm, "Keys present in am but missing in en").toEqual([]);
    expect(amKeys).toEqual(enKeys);
  });

  it("maintains strict key parity between config/locales/en.yml and config/locales/am.yml", () => {
    const rootDir = process.cwd();
    const enYamlContent = fs.readFileSync(path.join(rootDir, "config/locales/en.yml"), "utf-8");
    const amYamlContent = fs.readFileSync(path.join(rootDir, "config/locales/am.yml"), "utf-8");

    const enParsedUnknown: unknown = yaml.parse(enYamlContent);
    const amParsedUnknown: unknown = yaml.parse(amYamlContent);

    if (!isRecord(enParsedUnknown) || !isRecord(enParsedUnknown.en)) {
      throw new Error("Invalid en.yml structure");
    }
    if (!isRecord(amParsedUnknown) || !isRecord(amParsedUnknown.am)) {
      throw new Error("Invalid am.yml structure");
    }

    const enYamlKeys = getDeepKeys(enParsedUnknown.en);
    const amYamlKeys = getDeepKeys(amParsedUnknown.am);

    const missingInAmYaml = enYamlKeys.filter((k) => !amYamlKeys.includes(k));
    const extraInAmYaml = amYamlKeys.filter((k) => !enYamlKeys.includes(k));

    expect(missingInAmYaml, "Keys present in en.yml but missing in am.yml").toEqual([]);
    expect(extraInAmYaml, "Keys present in am.yml but missing in en.yml").toEqual([]);
    expect(amYamlKeys).toEqual(enYamlKeys);
  });

  it("injects default platform parameters (app_name, support_email, statement_descriptor) in translate()", () => {
    expect(
      translate(
        "test_platform_key",
        "en",
        undefined,
        "Welcome to {app_name} | {support_email} | {statement_descriptor}",
      ),
    ).toBe("Welcome to ArifDrop | support@arifdrop.com | ARIFDROP*");
    expect(translate("test_platform_key", "am", undefined, "እንኳን ወደ {app_name} በደህና መጡ")).toBe(
      "እንኳን ወደ አሪፍድሮፕ በደህና መጡ",
    );
  });
});
