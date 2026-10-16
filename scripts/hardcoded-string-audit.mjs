#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Hardcoded-string ratchet for app/javascript/.
 *
 * Counts user-visible strings that are baked into JSX and not routed through
 * a translation call.
 *
 * In-scope directories: All buyer, seller, and admin UI.
 * Explicit allowlist: Intentionally-English paths (Help Center, Tax Center, Public/Ping, widgets, marketing/legal).
 *
 * Goal: Zero hardcoded strings in scope.
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
// Config & Allowlist
// ---------------------------------------------------------------------------
const UPDATE_BASELINE = process.argv.includes("--update-baseline");

/** Intentionally-English paths exempt from localization */
const ALLOWLIST_RULES = [
  {
    name: "Help Center",
    match: (rel) => rel.startsWith("pages/HelpCenter") || rel.startsWith("components/HelpCenter"),
  },
  {
    name: "Tax Center",
    match: (rel) => rel.startsWith("pages/TaxCenter") || rel.startsWith("components/TaxCenter"),
  },
  {
    name: "Public/Ping",
    match: (rel) =>
      rel.startsWith("pages/Public/Ping") ||
      rel.startsWith("pages/Public/Api") ||
      rel.startsWith("pages/Public/Widgets"),
  },
  {
    name: "widgets",
    match: (rel) => rel.startsWith("widget"),
  },
  {
    name: "marketing/legal",
    match: (rel) => rel.startsWith("pages/GumroadBlog") || rel.startsWith("components/GumroadBlog"),
  },
];

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

/** Classify relative file path into in-scope directory bucket or null if allowlisted */
function getDirectoryBucket(filePath) {
  const rel = relative(JS_ROOT, filePath);

  for (const rule of ALLOWLIST_RULES) {
    if (rule.match(rel)) {
      return { type: "allowlist", name: rule.name };
    }
  }

  const parts = rel.split("/");
  const top = parts[0];

  if (top === "pages" && parts.length > 1) {
    return { type: "in_scope", name: `pages/${parts[1]}` };
  }
  if (top === "components" && parts.length > 2) {
    return { type: "in_scope", name: `components/${parts[1]}` };
  }
  return { type: "in_scope", name: top };
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

const inScopeCounts = {};
const allowlistCounts = {};

for (const f of files) {
  const bucket = getDirectoryBucket(f);
  const count = countHardcodedStrings(f);

  if (bucket.type === "allowlist") {
    allowlistCounts[bucket.name] = (allowlistCounts[bucket.name] ?? 0) + count;
  } else {
    inScopeCounts[bucket.name] = (inScopeCounts[bucket.name] ?? 0) + count;
  }
  process.stdout.write(".");
}

process.stdout.write("\n");

// Sort dirs for stable output.
const sortedInScope = Object.keys(inScopeCounts).sort();
const sortedAllowlist = Object.keys(allowlistCounts).sort();

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
console.log("\n┌─ Intentionally-English Paths (Allowlist — Exempt) ────────────┐");
for (const item of sortedAllowlist) {
  console.log(`│  ${item.padEnd(35)} ${String(allowlistCounts[item]).padStart(6)}`);
}
const allowlistTotal = Object.values(allowlistCounts).reduce((s, n) => s + n, 0);
console.log(`│  Total Allowlisted:${String(allowlistTotal).padStart(23)}`);
console.log("└───────────────────────────────────────────────────────────────┘");

console.log("\n┌─ In-Scope UI Directories (Goal: Zero) ───────────────────────┐");
for (const dir of sortedInScope) {
  console.log(`│  ${dir.padEnd(35)} ${String(inScopeCounts[dir]).padStart(6)}`);
}
const inScopeTotal = Object.values(inScopeCounts).reduce((s, n) => s + n, 0);
console.log(`│  Total In-Scope:${String(inScopeTotal).padStart(26)}`);
console.log("└───────────────────────────────────────────────────────────────┘\n");

// ---------------------------------------------------------------------------
// Baseline handling
// ---------------------------------------------------------------------------
if (UPDATE_BASELINE || !existsSync(BASELINE_PATH)) {
  const baseline = {
    _generated: new Date().toISOString().slice(0, 10),
    _description: "Hardcoded string counts per in-scope UI directory. Fail if count rises.",
    _allowlist_summary: allowlistCounts,
    ...Object.fromEntries(sortedInScope.map((d) => [d, inScopeCounts[d]])),
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`✅  Baseline updated at scripts/hardcoded-string-baseline.json (Total in-scope: ${inScopeTotal})`);
  process.exit(0);
}

// Compare against existing baseline.
const rawBaseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
// Support both legacy baseline format (top-level directory only) and per-directory format
const isLegacy = !Object.keys(rawBaseline).some((k) => k.startsWith("pages/"));

let failures = 0;
console.log("┌─ In-Scope Ratchet Check ───────────────────────────────────────┐");

if (isLegacy) {
  console.log("│  Notice: Existing baseline is in legacy format. Run with       │");
  console.log("│  --update-baseline to establish granular in-scope baseline.    │");
}

for (const dir of sortedInScope) {
  const current = inScopeCounts[dir];
  const base = rawBaseline[dir];
  if (base === undefined) {
    console.log(`│  ${dir.padEnd(35)}   new  → ${String(current).padStart(6)}  ℹ️  new`);
  } else {
    const delta = current - base;
    const status = delta > 0 ? "🔴 FAIL" : delta < 0 ? `🟢 -${-delta}` : "   ok";
    console.log(`│  ${dir.padEnd(35)} ${String(base).padStart(6)} → ${String(current).padStart(6)}  ${status}`);
    if (delta > 0) failures++;
  }
}
console.log("└───────────────────────────────────────────────────────────────┘");

if (failures > 0) {
  console.error(
    `\n❌  ${failures} in-scope director${failures === 1 ? "y has" : "ies have"} MORE hardcoded strings than the baseline.`,
  );
  console.error("   Fix them or run with --update-baseline if the increase is intentional.\n");
  process.exit(1);
} else {
  console.log("\n✅  All in-scope UI directories are at or below baseline.\n");
  process.exit(0);
}
