#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Hardcoded-string ratchet for app/javascript/.
 *
 * Counts user-visible strings that are baked into JSX and not routed through
 * a translation call. Groups by top-level directory. Fails (exit 1) if any
 * directory's count has risen above its baseline.
 *
 * Usage:
 *   node scripts/hardcoded-string-audit.mjs               # check against baseline
 *   node scripts/hardcoded-string-audit.mjs --update-baseline   # write new baseline
 */

import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, relative, extname } from "path";

const traverse = typeof _traverse === "function" ? _traverse : _traverse.default;

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/u, "");
const BASELINE_PATH = join(ROOT, "scripts/hardcoded-string-baseline.json");
const JS_ROOT = join(ROOT, "app/javascript");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const UPDATE_BASELINE = process.argv.includes("--update-baseline");

/** JSX attribute names whose string values are user-visible. */
const LABEL_ATTRS = new Set([
  "label",
  "placeholder",
  "aria-label",
  "title",
  "alt",
  "tooltip",
  "description",
  "buttonText",
  "emptyText",
  "noDataText",
  "children",
]);

/** Regex that matches something with real alphabetic words. */
const HAS_ALPHA_3 = /[a-zA-Z]{3,}/u;

/** Pure CSS-class / identifier pattern — not user-visible. */
const CSS_LIKE = /^[a-z0-9\-_]+$/u;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isUserVisible(str) {
  const s = str.trim();
  if (!s) return false;
  if (!HAS_ALPHA_3.test(s)) return false; // fewer than 3 consecutive alpha chars
  if (s.includes("://")) return false; // URL
  if (CSS_LIKE.test(s)) return false; // CSS class / key
  if (/^\d/u.test(s)) return false; // starts with digit
  return true;
}

/** Collect all TS/TSX files recursively, skipping excluded dirs/patterns. */
function collectFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "locales") continue;
      collectFiles(full, files);
    } else {
      const ext = extname(entry);
      if (ext !== ".ts" && ext !== ".tsx") continue;
      if (entry.endsWith(".test.ts") || entry.endsWith(".test.tsx")) continue;
      files.push(full);
    }
  }
  return files;
}

/** Top-level directory under app/javascript for a given absolute path. */
function topDir(filePath) {
  const rel = relative(JS_ROOT, filePath); // e.g. "components/Foo/Bar.tsx"
  return rel.split("/")[0]; // "components"
}

// ---------------------------------------------------------------------------
// AST analysis
// ---------------------------------------------------------------------------

function countHardcodedStrings(filePath) {
  const src = readFileSync(filePath, "utf8");
  const isTsx = filePath.endsWith(".tsx");

  let ast;
  try {
    ast = parse(src, {
      sourceType: "module",
      plugins: isTsx ? ["typescript", "jsx"] : ["typescript"],
      errorRecovery: true,
    });
  } catch {
    // Unparseable file — skip rather than crash.
    return 0;
  }

  let count = 0;

  traverse(ast, {
    JSXText(path) {
      if (isUserVisible(path.node.value)) {
        count++;
      }
    },

    JSXAttribute(path) {
      const nameNode = path.node.name;
      const attrName =
        nameNode.type === "JSXNamespacedName" ? `${nameNode.namespace.name}:${nameNode.name.name}` : nameNode.name;

      if (!LABEL_ATTRS.has(attrName)) return;

      const val = path.node.value;
      // Only plain string literals; skip JSXExpressionContainer (those may be t() calls).
      if (!val || val.type !== "StringLiteral") return;

      if (isUserVisible(val.value)) {
        count++;
      }
    },
  });

  return count;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const files = collectFiles(JS_ROOT);

process.stdout.write(`Scanning ${files.length} TS/TSX files`);

const dirCounts = {}; // { [topDir]: number }

for (const f of files) {
  const dir = topDir(f);
  dirCounts[dir] = (dirCounts[dir] ?? 0) + countHardcodedStrings(f);
  process.stdout.write(".");
}

process.stdout.write("\n");

// Sort dirs for stable output.
const sortedDirs = Object.keys(dirCounts).sort();

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
console.log("\n┌─ Hardcoded-string counts by directory ───────────────────────┐");
for (const dir of sortedDirs) {
  console.log(`│  ${dir.padEnd(30)} ${String(dirCounts[dir]).padStart(6)}`);
}
console.log("└───────────────────────────────────────────────────────────────┘");

const total = Object.values(dirCounts).reduce((s, n) => s + n, 0);
console.log(`   Total: ${total}\n`);

// ---------------------------------------------------------------------------
// Baseline handling
// ---------------------------------------------------------------------------
if (UPDATE_BASELINE || !existsSync(BASELINE_PATH)) {
  const baseline = {
    _generated: new Date().toISOString().slice(0, 10),
    _description: "Hardcoded string counts per directory. Fail if count rises.",
    ...Object.fromEntries(sortedDirs.map((d) => [d, dirCounts[d]])),
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`✅  Baseline written to scripts/hardcoded-string-baseline.json`);
  process.exit(0);
}

// Compare against existing baseline.
const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));

let failures = 0;
console.log("┌─ Ratchet check ───────────────────────────────────────────────┐");
for (const dir of sortedDirs) {
  const current = dirCounts[dir];
  const base = baseline[dir] ?? 0;
  const delta = current - base;
  const status = delta > 0 ? "🔴 FAIL" : delta < 0 ? `🟢 -${-delta}` : "   ok";
  console.log(`│  ${dir.padEnd(30)} ${String(base).padStart(6)} → ${String(current).padStart(6)}  ${status}`);
  if (delta > 0) failures++;
}
// Also check dirs in baseline that are no longer in current scan (OK — count dropped to 0).
console.log("└───────────────────────────────────────────────────────────────┘");

if (failures > 0) {
  console.error(
    `\n❌  ${failures} director${failures === 1 ? "y has" : "ies have"} MORE hardcoded strings than the baseline.`,
  );
  console.error("   Fix them or run with --update-baseline if the increase is intentional.\n");
  process.exit(1);
} else {
  console.log("\n✅  All directories at or below baseline.\n");
  process.exit(0);
}
