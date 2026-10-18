#!/usr/bin/env node
/* eslint-disable no-console */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const logoG = resolve(root, "public/images/logo-g.svg");
const logoSvg = resolve(root, "public/images/logo.svg");

if (!existsSync(logoG) || !existsSync(logoSvg)) {
  console.error("Missing source vector logo files in public/images/");
  process.exit(1);
}

console.log("Generating brand assets from source vector logos...");

// Favicon set
execSync(`magick -background none "${logoG}" -resize 16x16 "${resolve(root, "public/favicon-16x16.png")}"`);
execSync(`magick -background none "${logoG}" -resize 32x32 "${resolve(root, "public/favicon-32x32.png")}"`);
execSync(`magick -background none "${logoG}" -resize 180x180 "${resolve(root, "public/apple-touch-icon.png")}"`);
execSync(`magick -background none "${logoG}" -resize 192x192 "${resolve(root, "public/icon-192.png")}"`);
execSync(`magick -background none "${logoG}" -resize 512x512 "${resolve(root, "public/icon-512.png")}"`);
execSync(
  `magick "${resolve(root, "public/favicon-16x16.png")}" "${resolve(root, "public/favicon-32x32.png")}" "${resolve(root, "public/favicon.ico")}"`,
);

// Email header PNG (600x140 navy band with centered white wordmark)
const emailPng = resolve(root, "public/images/email/wordmark_logo.png");
execSync(
  `magick -size 600x140 xc:"#122540" \\( "${logoSvg}" -resize 360x90 -colorspace sRGB \\) -gravity center -composite "${emailPng}"`,
);

// OpenGraph share image
const ogPng = resolve(root, "public/images/opengraph_image.png");
const ogWebp = resolve(root, "public/images/opengraph_image.webp");
execSync(`magick "${ogPng}" -quality 82 "${ogWebp}"`);

console.log("All brand assets generated successfully!");
