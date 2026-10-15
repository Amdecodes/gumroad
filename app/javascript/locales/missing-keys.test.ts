// @vitest-environment node
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";

import { am } from "./am";
import { en } from "./en";

// ── Dictionary helpers ─────────────────────────────────────────────────────

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

const getNestedValue = (obj: object, keyPath: string): unknown => {
  let current: unknown = obj;
  for (const part of keyPath.split(".")) {
    if (isObject(current) && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return current;
};

// ── File discovery ─────────────────────────────────────────────────────────

const collectTsFiles = (dir: string, results: string[] = []): string[] => {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTsFiles(fullPath, results);
    } else if (/\.[cm]?tsx?$/u.test(entry.name) && !/\.test\.[cm]?tsx?$/u.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
};

// ── Key extraction via AST ─────────────────────────────────────────────────

interface KeyUsage {
  key: string;
  file: string;
  line: number;
}

/** Returns true when the callee looks like a translation call: t(), translate(), or *.t() */
const isTranslationCallee = (
  node: import("@babel/types").Expression | import("@babel/types").V8IntrinsicIdentifier | null | undefined,
): boolean => {
  if (!node) return false;
  if (node.type === "Identifier") {
    return node.name === "t" || node.name === "translate";
  }
  if (node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier") {
    return node.property.name === "t";
  }
  return false;
};

const KEY_FILTER_RE = /\$app\//u;

/** Heuristic: skip strings that are clearly not i18n keys (imports, CSS, bare words without structure). */
const looksLikeI18nKey = (key: string): boolean => {
  if (KEY_FILTER_RE.test(key)) return false;
  if (key.length <= 1) return false;
  // Must look like a dotted path or a simple word that could be a top-level key.
  // We let through anything that doesn't look like a URL, CSS class, or file path.
  if (/^https?:\/\//u.test(key)) return false;
  if (/^[./\\]/u.test(key)) return false;
  // Reject keys with spaces — i18n keys never contain spaces.
  if (/\s/u.test(key)) return false;
  return true;
};

const extractKeysFromFile = (filePath: string): KeyUsage[] => {
  const src = fs.readFileSync(filePath, "utf-8");
  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(src, {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
      errorRecovery: true,
    });
  } catch {
    // Unparseable files are silently skipped; not our concern here.
    return [];
  }

  const usages: KeyUsage[] = [];

  traverse(ast, {
    CallExpression(nodePath) {
      const { node } = nodePath;
      if (!isTranslationCallee(node.callee)) return;

      const firstArg = node.arguments[0];
      if (!firstArg || firstArg.type !== "StringLiteral") return;

      const key = firstArg.value;
      if (!looksLikeI18nKey(key)) return;

      usages.push({
        key,
        file: filePath,
        line: firstArg.loc?.start.line ?? 0,
      });
    },
  });

  return usages;
};

// ── Test ───────────────────────────────────────────────────────────────────

describe("Missing i18n keys", () => {
  it("reports all translation keys used in source that are absent from en or am dictionaries", () => {
    const repoRoot = path.resolve(process.cwd());

    const scanDirs = [path.join(repoRoot, "app/javascript/components"), path.join(repoRoot, "app/javascript/utils")];

    const files = scanDirs.flatMap((d) => collectTsFiles(d));
    const allUsages = files.flatMap((f) => extractKeysFromFile(f));

    // Deduplicate by key so the failure message is concise.
    const uniqueKeys = new Map<string, KeyUsage>();
    for (const usage of allUsages) {
      if (!uniqueKeys.has(usage.key)) {
        uniqueKeys.set(usage.key, usage);
      }
    }

    const missingFromEn: KeyUsage[] = [];
    const missingFromAm: KeyUsage[] = [];

    for (const [key, usage] of uniqueKeys) {
      const inEn = getNestedValue(en, key);
      const inAm = getNestedValue(am, key);
      if (inEn === undefined) missingFromEn.push(usage);
      if (inAm === undefined) missingFromAm.push(usage);
    }

    const formatMissing = (usages: KeyUsage[], dict: string): string =>
      usages
        .map((u) => `  • '${u.key}' used in ${path.relative(repoRoot, u.file)}:${u.line} — missing from ${dict}`)
        .join("\n");

    const messages: string[] = [];
    if (missingFromEn.length > 0) {
      messages.push(
        `Keys missing from 'en' dictionary (${missingFromEn.length}):\n${formatMissing(missingFromEn, "en")}`,
      );
    }
    if (missingFromAm.length > 0) {
      messages.push(
        `Keys missing from 'am' dictionary (${missingFromAm.length}):\n${formatMissing(missingFromAm, "am")}`,
      );
    }

    expect(messages, messages.join("\n\n")).toHaveLength(0);
  });
});
