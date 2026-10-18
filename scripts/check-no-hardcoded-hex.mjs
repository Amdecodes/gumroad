#!/usr/bin/env node
/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const appJsDir = path.resolve(rootDir, "app/javascript");

// Files or directory patterns permitted to contain hex color codes
const ALLOWLISTED_FILES = new Set([
  "app/javascript/stylesheets/tailwind.css",
  "app/javascript/stylesheets/_definitions.scss",
  "app/javascript/stylesheets/_colors.scss",
  "app/javascript/stylesheets/_email.scss",
  "app/javascript/stylesheets/_rich_text.scss", // Syntax highlighting for code blocks
  "app/javascript/entrypoints/email.scss",
  "app/javascript/packs/email.scss",
  "app/javascript/utils/color.ts",
  "app/javascript/utils/color.test.ts",
  "app/javascript/components/TiptapExtensions/Link.tsx", // Inline style for email clients
  "app/javascript/pages/Settings/Profile/Show.tsx", // Seller theme preset definitions
  "app/javascript/pages/UrlRedirects/Read.tsx", // E-reader theme presets
  "app/javascript/components/Button.tsx", // Third-party brand integration button colors
]);

const ALLOWLISTED_DIR_PATTERNS = [
  "app/javascript/components/icons/getting-started/", // SVG icon artwork
];

function isAllowlisted(relPath) {
  if (ALLOWLISTED_FILES.has(relPath)) return true;
  if (relPath.endsWith(".test.ts") || relPath.endsWith(".test.tsx")) return true;
  for (const pattern of ALLOWLISTED_DIR_PATTERNS) {
    if (relPath.startsWith(pattern)) return true;
  }
  return false;
}

function walk(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walk(full));
    } else if (/\.(tsx?|scss|css)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

const HEX_COLOR_REGEX = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;

let violations = [];
const files = walk(appJsDir);

for (const file of files) {
  const relPath = path.relative(rootDir, file).replace(/\\/g, "/");
  if (isAllowlisted(relPath)) continue;

  const content = fs.readFileSync(file, "utf8");
  // Strip block comments
  const cleanContent = content.replace(/\/\*[\s\S]*?\*\//g, (match) => " ".repeat(match.length));
  const lines = cleanContent.split("\n");

  lines.forEach((line, index) => {
    // Strip inline comments and HTML entities
    const codeOnly = line.split("//")[0].replace(/&#\d+;/g, "").replace(/&nbsp;/g, "");

    const matches = codeOnly.match(HEX_COLOR_REGEX);
    if (matches && matches.length > 0) {
      violations.push({
        file: relPath,
        line: index + 1,
        colors: matches,
        text: line.trim(),
      });
    }
  });
}

console.log("================================================================================");
console.log("          ARIFDROP DESIGN SYSTEM - HARDCODED HEX COLOR AUDIT                    ");
console.log("================================================================================");

if (violations.length > 0) {
  console.error(`\nFAILED: Found ${violations.length} hardcoded hex color(s) outside token files:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} -> ${v.colors.join(", ")}`);
    console.error(`    ${v.text}\n`);
  }
  process.exit(1);
} else {
  console.log(`\nSUCCESS: Zero hardcoded hex colors outside designated token files! (${files.length} files scanned)`);
  process.exit(0);
}
