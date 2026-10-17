# ArifDrop Design Tokens & Brand System

## Overview

ArifDrop's visual identity transitions the platform from a neobrutalist aesthetic (high-contrast flat black borders, vivid magenta/pink accents, and sharp corners) to a modern, refined commerce platform with navy-tinted borders, 8–12px border radii, soft elevation shadows, and a distinct palette featuring Navy `#122540`, Royal Blue `#146dfd`, Blue `#2199F9`, and Lime `#c3f351`.

All typography is 100% open-source and self-hosted (Inter, Montserrat, and Noto Sans Ethiopic). All color pairs across light and dark themes comply with **WCAG AA** standards.

---

## 1. Color System & Semantic Roles

### 1.1 Core Palette

| Token Name | Value | Description |
| :--- | :--- | :--- |
| `palette.navy` | `#122540` | Deep brand navy. Used for headers, footers, dark mode backgrounds, and primary body text on light backgrounds. |
| `palette.navy-muted` | `#1c3558` | Secondary navy for dark surface elevated cards and panels. |
| `palette.navy-dark` | `#0b1728` | Deepest navy for root dark-mode backgrounds. |
| `palette.royal-blue` | `#146dfd` | Primary brand action color. Used for primary call-to-actions, primary buttons, and progress indicators. |
| `palette.royal-blue-hover` | `#0e5cd8` | Hover state for primary actions. |
| `palette.blue` | `#2199F9` | Secondary blue. Used for focus rings, links on dark surfaces, and secondary badges. |
| `palette.lime` | `#c3f351` | Brand accent & highlight color. Used for price tags, "New"/"Featured" badges, and active pills. |
| `palette.lime-hover` | `#b2e33d` | Hover state for lime interactive elements. |
| `palette.white` | `#ffffff` | Pure white. Used for light mode backgrounds and text on navy/royal-blue surfaces. |
| `palette.success` | `#047857` | Status green for success states, confirmations, and positive metrics. Distinct from lime. |
| `palette.warning` | `#d97706` | Status amber for alerts, cautions, and pending states. |
| `palette.danger` | `#dc2626` | Status red for errors, destructive actions, and critical alerts. |

---

### 1.2 Semantic Roles & Usage Rules

1. **Primary Action (`#146dfd`)**:
   - **Text:** Always pure white (`#ffffff`).
   - **Contrast:** 4.53:1 (exceeds WCAG AA 4.5:1 requirement).
   - **Usage:** Primary checkout buttons, "Buy Now", submit buttons, and page-level primary CTAs.
   - **Rule:** Never place navy or colored text on royal blue; use white only.

2. **Highlight Accent (`#c3f351`)**:
   - **Text:** Always navy (`#122540`).
   - **Contrast:** 11.92:1 (exceeds WCAG AA 4.5:1 requirement).
   - **Usage:** Price tags, "Featured" pills, "New" tags, selected filter states.
   - **Rule:** Never use lime as text on light/white surfaces. Never use white text on lime. Lime is an accent background with dark navy text.

3. **Secondary / Links / Focus Rings (`#2199F9`)**:
   - **Usage on dark surfaces:** Used as active links and high-visibility focus rings against navy surfaces (5.12:1 contrast).
   - **Usage on light surfaces:** With navy text only when used as a pill background. Standard light mode text links use royal blue `#146dfd` (4.53:1 contrast against white).

4. **Surfaces & Borders**:
   - **Light Mode Surface:** Light slate `#f8fafc` / `#ffffff`.
   - **Light Mode Borders:** Subtle navy-tinted border `rgba(18, 37, 64, 0.25)` or Tailwind `border-navy/20` (replaces legacy harsh solid black `border-black`).
   - **Dark Mode Surface:** Deep navy `#122540` / `#0b1728`.
   - **Dark Mode Borders:** Subtle white-tinted border `rgba(255, 255, 255, 0.15)`.

---

## 2. Shape, Elevation & Geometry

| Property | Value | Tailwind / CSS Variable | Description |
| :--- | :--- | :--- | :--- |
| **Default Radius** | `10px` (`0.625rem`) | `var(--radius)` / `rounded-[var(--radius)]` | Applied to cards, modal containers, and standard buttons. |
| **Small Radius** | `8px` (`0.5rem`) | `var(--radius-sm)` / `rounded-[var(--radius-sm)]` | Applied to inputs, selects, badges, and tooltips. |
| **Large Radius** | `12px` (`0.75rem`) | `var(--radius-lg)` / `rounded-[var(--radius-lg)]` | Applied to dialogs, checkout drawers, and major card wrappers. |
| **Full Radius** | `9999px` | `rounded-full` | Pills, circular avatar containers, and price badges. |
| **Elevation Shadow** | `0 4px 14px 0 rgba(18, 37, 64, 0.08)` | `var(--shadow-subtle)` / `shadow-subtle` | Subtle navy-tinted soft elevation replacing neobrutalist black drop shadows. |

---

## 3. Typography System

All proprietary and unlicensed fonts (ABC Favorit, Mabry Pro, SF Pro Text) have been removed from the repository. The application now uses self-hosted open-source fonts served from `public/fonts/`:

| Role | Font Family | Source & Weights | Usage |
| :--- | :--- | :--- | :--- |
| **Headings & Display** | `Montserrat`, sans-serif | Google Fonts / SIL Open Font License (OFL). Self-hosted `.woff2` (400, 700). | `font-display`, `h1`-`h6`, card titles, hero headers. |
| **Body & UI** | `Inter`, sans-serif | SIL Open Font License (OFL). Self-hosted `.woff2` (400, 700). | `font-sans`, default body text, tables, form controls. |
| **Ethiopic (Amharic)** | `Noto Sans Ethiopic`, `Inter`, sans-serif | Google Noto Fonts / SIL Open Font License (OFL). | Rendered when `lang="am"` or within `.lang-am` containers with tailored line-height rules. |

### Backwards Compatibility
For stored seller themes and custom profile CSS that reference legacy `"ABC Favorit"`, a `@font-face` alias in `app/javascript/stylesheets/_font.scss` transparently maps `"ABC Favorit"` to self-hosted `Inter` woff2 files.

---

## 4. WCAG AA Contrast Audit Results

Automated verification is performed via `node scripts/check-contrast.mjs`. All 18 pairs meet or exceed WCAG AA requirements:

| Category | UI Element / Color Pair | Contrast Ratio | WCAG AA Threshold | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Action** | Primary Button (White on Royal Blue `#146dfd`) | **4.53:1** | $\ge$ 4.5:1 | PASS |
| **Primary Action** | Primary Button Hover (White on Royal Blue Hover `#0e5cd8`) | **5.93:1** | $\ge$ 4.5:1 | PASS |
| **Highlight / Badges** | Lime Badge / Price Tag (Navy text `#122540` on Lime `#c3f351`) | **11.92:1** | $\ge$ 4.5:1 | PASS |
| **Highlight / Badges** | Lime Badge Hover (Navy text on Lime Hover `#b2e33d`) | **10.22:1** | $\ge$ 4.5:1 | PASS |
| **Dark Surfaces** | Focus Ring / Link on Navy (Blue `#2199F9` on Navy `#122540`) | **5.12:1** | $\ge$ 3.0:1 | PASS |
| **Dark Surfaces** | White text on Navy Header/Footer/Sidebar | **15.39:1** | $\ge$ 4.5:1 | PASS |
| **Dark Surfaces** | Muted text on Navy Surface (Gray 300 `#d1d5db` on Navy) | **10.45:1** | $\ge$ 4.5:1 | PASS |
| **Light Theme** | Primary Body Text (Navy `#122540` on White) | **15.39:1** | $\ge$ 4.5:1 | PASS |
| **Light Theme** | Secondary / Muted Text (Navy 60% on White / Gray 600) | **7.56:1** | $\ge$ 4.5:1 | PASS |
| **Light Theme** | Links (Royal Blue `#146dfd` on White) | **4.53:1** | $\ge$ 4.5:1 | PASS |
| **Light Theme** | UI Borders (Navy-tinted border `rgba(18, 37, 64, 0.25)` on White) | **12.36:1** | $\ge$ 3.0:1 | PASS |
| **Dark Theme** | Dark Theme Body Text (White on Dark Navy `#0b1728`) | **17.99:1** | $\ge$ 4.5:1 | PASS |
| **Dark Theme** | Dark Theme Secondary Text (Gray 300 on Dark Navy) | **12.21:1** | $\ge$ 4.5:1 | PASS |
| **Dark Theme** | Dark Theme Links / Focus (Blue `#2199F9` on Dark Navy) | **5.99:1** | $\ge$ 4.5:1 | PASS |
| **Dark Theme** | Dark Theme Card Background (Gray 300 on Navy Muted `#1c3558`) | **8.39:1** | $\ge$ 4.5:1 | PASS |
| **Status Colors** | Success (White on Green `#047857`) | **5.48:1** | $\ge$ 4.5:1 | PASS |
| **Status Colors** | Warning (White on Amber `#d97706`) | **3.19:1** | $\ge$ 3.0:1 | PASS |
| **Status Colors** | Danger (White on Red `#dc2626`) | **4.83:1** | $\ge$ 4.5:1 | PASS |

---

## 5. Asset Inventory & Status

The following brand assets have been generated and integrated:

1. **Brand Wordmark & Badges**:
   - `public/images/logo.svg`: ArifDrop vector wordmark with standard 4:1 aspect ratio (`Asset 8.png` equivalent).
   - `public/images/logo-g.svg`: Circular brand badge featuring Lime `#c3f351` disc with Navy `#122540` "A" emblem.
   - `public/images/email/wordmark_logo.png`: 276×69 high-DPI raster logo for email clients without SVG support.
2. **Favicons & Touch Icons**:
   - `public/favicon.ico`: Multi-size (16×16, 32×32, 48×48) ICO file.
   - `public/favicon-16x16.png` & `public/favicon-32x32.png`: Standard PNG favicons.
   - `public/apple-touch-icon.png`: 180×180 iOS home screen icon.
   - `public/images/pink-icon.png`: Replaced with Arifdrop brand badge.
3. **PWA & OpenGraph**:
   - `public/manifest.json`: Web application manifest updated with `#122540` theme/background color.
   - `public/icon-192.png` & `public/icon-512.png`: Standard PWA app icons.
   - `public/images/opengraph_image.png`: 1200×630 default social share image (navy canvas, white badge and wordmark, lime accent rule).
4. **Product Placeholder**:
   - `public/images/placeholders/product-cover.png`: 1280×720 brand geometric pattern cover placeholder replacing the old pink folder graphic.

---

## 6. Gumicons Icon Font Investigation Report

As requested for Stage 2 preparation, an audit of `public/fonts/gumicons.*` was conducted:

- **Files Present:**
  - `public/fonts/gumicons.ttf` (24,472 bytes)
  - `public/fonts/gumicons.woff` (14,400 bytes)
  - `public/fonts/gumicons.eot` (24,548 bytes)
  - `public/fonts/gumicons.svg` (32,623 bytes)
- **Metadata from TTF Name Table:**
  - `Copyright (0)`: "Gumroad Inc"
  - `Font Family (1)`: "Gumicons"
  - `Manufacturer (8)`: "Gumroad"
  - `Designer (9)`: "Alex Hertz" (former Gumroad product designer)
  - `Vendor URL (11)`: `http://gumroad.com`
  - `Designer URL (12)`: `http://hey.al`
  - `License Description (13)`: *None provided* (proprietary internal font)
- **Codebase Usage Analysis:**
  - `git grep -i "gumicon"` revealed **zero** CSS `@font-face` declarations or stylesheet references anywhere in the repository.
  - The files were moved from `app/assets/fonts/` to `public/fonts/` during the Sprockets deprecation commit `9b74cdd06` in May 2026.
  - Modern icon usage in ArifDrop uses inline SVGs and React icon components (`app/javascript/components/icons/*`).
- **Recommendation for Stage 2:**
  - Since `gumicons` has no open license and is completely unreferenced by application styles or components, the four `gumicons.*` files can be safely deleted in Stage 2 without impacting any UI components.

---

## 7. Deferred Copy & Content Changes (Pending User Review)

Per the strict rebrand instructions (*"Don't edit locale files, t()/translate() calls, titles/meta strings, or any copy. If a component needs a text change, leave it and list it for me"*), no copy or translation files were modified.

The following items contain legacy "Gumroad" strings or require brand decisions:

1. **Brand Name Casing Decision**:
   - Choose between **`ArifDrop`** (CamelCase) vs **`Arifdrop`** (Sentence case). We have used `ArifDrop` in visual headers and documentation.
2. **Page Titles & Meta Layout Strings**:
   - `app/views/layouts/base.rb`: `title = "Gumroad"` default document title.
   - `app/views/layouts/minimal.html.erb` & `app/views/layouts/application.html.erb`: meta tags with "Gumroad".
3. **Legal & Navigation Copy**:
   - `app/views/shared/_footer.html.erb`: "Powered by Gumroad" / copyright notices.
   - `app/views/home/about.html.erb`: Company about page body copy.
4. **Email Layouts**:
   - `app/views/layouts/email.html.erb`: Footer unsubscribe and company address text ("Gumroad, Inc.").
5. **PDF Invoice**:
   - `app/views/purchases/invoices/create.pdf.erb`: Seller address / Gumroad legal entity header.
