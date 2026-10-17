#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * WCAG AA Contrast Verification Script for ArifDrop Design System
 *
 * Verifies all color pairs across light and dark themes meet WCAG AA standards:
 * - Normal text: >= 4.5:1
 * - Large text (>= 18pt / 24px or >= 14pt / 18.66px bold): >= 3.0:1
 * - UI components and graphical objects: >= 3.0:1
 */

function parseHex(hex) {
  const cleanHex = hex.replace("#", "").trim();
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return [r, g, b];
  }
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return [r, g, b];
  }
  throw new Error(`Invalid hex color: ${hex}`);
}

function relativeLuminance(rgb) {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hex1, hex2) {
  const lum1 = relativeLuminance(parseHex(hex1));
  const lum2 = relativeLuminance(parseHex(hex2));
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Color Palette Definitions
const PALETTE = {
  navy: "#122540",
  navyMuted: "#1c3558",
  navyDark: "#0b1728",
  blue: "#2199F9",
  royalBlue: "#146dfd",
  royalBlueHover: "#0e5cd8",
  lime: "#c3f351",
  limeHover: "#b2e33d",
  white: "#ffffff",
  black: "#000000",
  gray50: "#f9fafb",
  gray100: "#f3f4f6",
  gray200: "#e5e7eb",
  gray300: "#d1d5db",
  gray400: "#9ca3af",
  gray500: "#6b7280",
  gray600: "#4b5563",
  gray700: "#374151",
  gray800: "#1f2937",
  gray900: "#111827",
  // Status colors (distinct from lime)
  successGreen: "#047857",
  warningAmber: "#d97706",
  dangerRed: "#dc2626",
};

// UI Color Pair Specifications to Test
const COLOR_PAIRS = [
  // Primary Button: Royal blue background with white text
  {
    category: "Primary Action",
    name: "Primary Button (White on Royal Blue)",
    fg: PALETTE.white,
    bg: PALETTE.royalBlue,
    minRatio: 4.5,
    role: "Normal text",
  },
  {
    category: "Primary Action",
    name: "Primary Button Hover (White on Royal Blue Hover)",
    fg: PALETTE.white,
    bg: PALETTE.royalBlueHover,
    minRatio: 4.5,
    role: "Normal text",
  },
  // Lime Highlights: Price tags, badges, selected pills (MUST be with navy text)
  {
    category: "Highlight / Badges",
    name: "Lime Badge / Price Tag (Navy text on Lime)",
    fg: PALETTE.navy,
    bg: PALETTE.lime,
    minRatio: 4.5,
    role: "Normal text",
  },
  {
    category: "Highlight / Badges",
    name: "Lime Badge Hover (Navy text on Lime Hover)",
    fg: PALETTE.navy,
    bg: PALETTE.limeHover,
    minRatio: 4.5,
    role: "Normal text",
  },
  // Blue accent: Focus rings and links on dark navy surfaces
  {
    category: "Dark Surfaces",
    name: "Focus Ring / Link on Navy (Blue on Navy)",
    fg: PALETTE.blue,
    bg: PALETTE.navy,
    minRatio: 3.0,
    role: "UI component / Large text / Link",
  },
  {
    category: "Dark Surfaces",
    name: "White text on Navy Header/Footer/Sidebar",
    fg: PALETTE.white,
    bg: PALETTE.navy,
    minRatio: 4.5,
    role: "Normal text",
  },
  {
    category: "Dark Surfaces",
    name: "Muted text on Navy Surface (Gray 300 on Navy)",
    fg: PALETTE.gray300,
    bg: PALETTE.navy,
    minRatio: 4.5,
    role: "Normal text",
  },
  // Light Surfaces (Light Theme)
  {
    category: "Light Theme",
    name: "Primary Body Text (Navy on White)",
    fg: PALETTE.navy,
    bg: PALETTE.white,
    minRatio: 4.5,
    role: "Normal text",
  },
  {
    category: "Light Theme",
    name: "Secondary / Muted Text (Navy 60% on White / Gray 600 on White)",
    fg: PALETTE.gray600,
    bg: PALETTE.white,
    minRatio: 4.5,
    role: "Normal text",
  },
  {
    category: "Light Theme",
    name: "Links (Royal Blue on White)",
    fg: PALETTE.royalBlue,
    bg: PALETTE.white,
    minRatio: 4.5,
    role: "Normal text",
  },
  {
    category: "Light Theme",
    name: "UI Borders (Navy-tinted border on White)",
    fg: PALETTE.navyMuted,
    bg: PALETTE.white,
    minRatio: 3.0,
    role: "UI border / component boundary",
  },
  // Dark Theme
  {
    category: "Dark Theme",
    name: "Dark Theme Body Text (White on Dark Navy)",
    fg: PALETTE.white,
    bg: PALETTE.navyDark,
    minRatio: 4.5,
    role: "Normal text",
  },
  {
    category: "Dark Theme",
    name: "Dark Theme Secondary Text (Gray 300 on Dark Navy)",
    fg: PALETTE.gray300,
    bg: PALETTE.navyDark,
    minRatio: 4.5,
    role: "Normal text",
  },
  {
    category: "Dark Theme",
    name: "Dark Theme Links (#2199F9 on Dark Navy #0b1728)",
    fg: PALETTE.blue,
    bg: PALETTE.navyDark,
    minRatio: 4.5,
    role: "Normal text / Link",
  },
  {
    category: "Dark Theme",
    name: "Dark Theme Links (#2199F9 on Navy Surface #122540)",
    fg: PALETTE.blue,
    bg: PALETTE.navy,
    minRatio: 4.5,
    role: "Normal text / Link",
  },
  {
    category: "Dark Theme",
    name: "Dark Theme Card Background (Gray 300 on Navy Muted)",
    fg: PALETTE.gray300,
    bg: PALETTE.navyMuted,
    minRatio: 4.5,
    role: "Normal text",
  },
  // Status Colors (Success, Warning, Danger) distinct from Lime
  {
    category: "Status Colors",
    name: "Success (White on Green)",
    fg: PALETTE.white,
    bg: PALETTE.successGreen,
    minRatio: 4.5,
    role: "Normal text",
  },
  {
    category: "Status Colors",
    name: "Warning (White on Amber)",
    fg: PALETTE.white,
    bg: PALETTE.warningAmber,
    minRatio: 3.0,
    role: "UI badge / Large text",
  },
  {
    category: "Status Colors",
    name: "Danger (White on Red)",
    fg: PALETTE.white,
    bg: PALETTE.dangerRed,
    minRatio: 4.5,
    role: "Normal text",
  },
  // Form controls & states
  {
    category: "Form Controls",
    name: "Placeholder Text (Slate 600 on White in Light Theme)",
    fg: "#475569",
    bg: PALETTE.white,
    minRatio: 4.5,
    role: "Placeholder text",
  },
  {
    category: "Form Controls",
    name: "Placeholder Text (Slate 400 on Navy in Dark Theme)",
    fg: "#94a3b8",
    bg: PALETTE.navy,
    minRatio: 4.5,
    role: "Placeholder text",
  },
  {
    category: "Form Controls",
    name: "Disabled Control State (Slate 500 on Gray 200)",
    fg: "#64748b",
    bg: "#e2e8f0",
    minRatio: 3.0,
    role: "Disabled UI element",
  },
  // Focus rings against adjacent backgrounds
  {
    category: "Focus Rings",
    name: "Focus Ring Light (#146dfd on White)",
    fg: PALETTE.royalBlue,
    bg: PALETTE.white,
    minRatio: 3.0,
    role: "UI component outline",
  },
  {
    category: "Focus Rings",
    name: "Focus Ring Dark (#2199F9 on Dark Navy #0b1728)",
    fg: PALETTE.blue,
    bg: PALETTE.navyDark,
    minRatio: 3.0,
    role: "UI component outline",
  },
  {
    category: "Focus Rings",
    name: "Focus Ring Dark Surface (#2199F9 on Navy #122540)",
    fg: PALETTE.blue,
    bg: PALETTE.navy,
    minRatio: 3.0,
    role: "UI component outline",
  },
  // Feedback banners (Text on tinted backgrounds)
  {
    category: "Feedback Banners",
    name: "Error Banner (Dark Red #b91c1c on Red Tint #fee2e2)",
    fg: "#b91c1c",
    bg: "#fee2e2",
    minRatio: 4.5,
    role: "Alert normal text",
  },
  {
    category: "Feedback Banners",
    name: "Success Banner (Emerald #047857 on Emerald Tint #dcfce7)",
    fg: "#047857",
    bg: "#dcfce7",
    minRatio: 4.5,
    role: "Alert normal text",
  },
  {
    category: "Feedback Banners",
    name: "Warning Banner (Amber #92400e on Amber Tint #fef3c7)",
    fg: "#92400e",
    bg: "#fef3c7",
    minRatio: 4.5,
    role: "Alert normal text",
  },
  // Pills & Badges
  {
    category: "Pills & Badges",
    name: "Selected Pill Primary (White on Royal Blue #146dfd)",
    fg: PALETTE.white,
    bg: PALETTE.royalBlue,
    minRatio: 4.5,
    role: "Active pill text",
  },
  {
    category: "Pills & Badges",
    name: "Selected Pill Highlight (Navy #122540 on Lime #c3f351)",
    fg: PALETTE.navy,
    bg: PALETTE.lime,
    minRatio: 4.5,
    role: "Active pill text",
  },
  // Chart Colors (against Light & Dark canvas)
  {
    category: "Chart Colors",
    name: "Chart Line / Bar (Royal Blue on White)",
    fg: PALETTE.royalBlue,
    bg: PALETTE.white,
    minRatio: 3.0,
    role: "Graphical data object",
  },
  {
    category: "Chart Colors",
    name: "Chart Line / Bar (Green on White)",
    fg: PALETTE.successGreen,
    bg: PALETTE.white,
    minRatio: 3.0,
    role: "Graphical data object",
  },
  {
    category: "Chart Colors",
    name: "Chart Line / Bar (Red on White)",
    fg: PALETTE.dangerRed,
    bg: PALETTE.white,
    minRatio: 3.0,
    role: "Graphical data object",
  },
  {
    category: "Chart Colors",
    name: "Chart Line / Bar (Blue #2199F9 on Dark Navy #0b1728)",
    fg: PALETTE.blue,
    bg: PALETTE.navyDark,
    minRatio: 3.0,
    role: "Graphical data object",
  },
  {
    category: "Chart Colors",
    name: "Chart Line / Bar (Lime #c3f351 on Dark Navy #0b1728)",
    fg: PALETTE.lime,
    bg: PALETTE.navyDark,
    minRatio: 3.0,
    role: "Graphical data object",
  },
  // Email Styles
  {
    category: "Email Styles",
    name: "Email Header Band (White on Navy #122540)",
    fg: PALETTE.white,
    bg: PALETTE.navy,
    minRatio: 4.5,
    role: "Email header text",
  },
  {
    category: "Email Styles",
    name: "Email Body Text (Navy #122540 on White)",
    fg: PALETTE.navy,
    bg: PALETTE.white,
    minRatio: 4.5,
    role: "Email content text",
  },
  {
    category: "Email Styles",
    name: "Email CTA Button (White on Royal Blue #146dfd)",
    fg: PALETTE.white,
    bg: PALETTE.royalBlue,
    minRatio: 4.5,
    role: "Email button text",
  },
  {
    category: "Email Styles",
    name: "Email Footer Muted Text (Slate 600 on Gray 50)",
    fg: "#475569",
    bg: "#f8fafc",
    minRatio: 4.5,
    role: "Email footer text",
  },
  // Invoice PDF Styles
  {
    category: "Invoice PDF",
    name: "Invoice Body & Heading (Navy #122540 on White)",
    fg: PALETTE.navy,
    bg: PALETTE.white,
    minRatio: 4.5,
    role: "Invoice document text",
  },
  {
    category: "Invoice PDF",
    name: "Invoice Table Headers (Slate 600 on Gray 50)",
    fg: "#475569",
    bg: "#f8fafc",
    minRatio: 4.5,
    role: "Invoice table labels",
  },
  {
    category: "Invoice PDF",
    name: "Invoice Total Highlight Row (Navy #122540 on Gray 100)",
    fg: PALETTE.navy,
    bg: "#f1f5f9",
    minRatio: 4.5,
    role: "Invoice summary row",
  },
];

function runAudit() {
  console.log("================================================================================");
  console.log("            ARIFDROP DESIGN SYSTEM - WCAG AA CONTRAST AUDIT                     ");
  console.log("================================================================================\n");

  let allPassed = true;
  let passedCount = 0;
  let failedCount = 0;

  for (const item of COLOR_PAIRS) {
    const ratio = contrastRatio(item.fg, item.bg);
    const passed = ratio >= item.minRatio;
    const formattedRatio = `${ratio.toFixed(2)}:1`;
    const minStr = `>= ${item.minRatio.toFixed(1)}:1`;

    if (passed) {
      passedCount++;
      console.log(
        `[PASS] ${item.category.padEnd(16)} | ${item.name.padEnd(46)} | ${formattedRatio.padEnd(8)} (required ${minStr})`,
      );
    } else {
      failedCount++;
      allPassed = false;
      console.error(
        `[FAIL] ${item.category.padEnd(16)} | ${item.name.padEnd(46)} | ${formattedRatio.padEnd(8)} (required ${minStr})`,
      );
    }
  }

  console.log("\n--------------------------------------------------------------------------------");
  console.log(`Summary: ${passedCount} passed, ${failedCount} failed (${COLOR_PAIRS.length} total)`);
  console.log("--------------------------------------------------------------------------------\n");

  if (!allPassed) {
    console.error("FAIL: One or more color contrast pairs did not meet WCAG AA requirements.");
    process.exit(1);
  } else {
    console.log("SUCCESS: All design token color pairs comply with WCAG AA requirements!");
  }
}

runAudit();
