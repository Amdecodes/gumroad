# Stage 3A: Structural Redesign Prototypes

This directory contains standalone HTML/CSS prototypes exploring two distinct design directions for the structural redesign of ArifDrop.

## Prototype Locations & Interactive Viewer

Open `docs/design/prototypes/index.html` in any browser to interactively preview both directions across 1280px desktop and 375px mobile viewports, with integrated English/Amharic and Light/Dark toggles.

- **Direction A ("Clean Marketplace"):**
  - Discover: [`docs/design/prototypes/direction-a/discover/index.html`](./direction-a/discover/index.html)
  - Product Page: [`docs/design/prototypes/direction-a/product/index.html`](./direction-a/product/index.html)
  - Seller Dashboard: [`docs/design/prototypes/direction-a/dashboard/index.html`](./direction-a/dashboard/index.html)
  - Buyer Library: [`docs/design/prototypes/direction-a/library/index.html`](./direction-a/library/index.html)

- **Direction B ("Bold Brand"):**
  - Discover: [`docs/design/prototypes/direction-b/discover/index.html`](./direction-b/discover/index.html)
  - Product Page: [`docs/design/prototypes/direction-b/product/index.html`](./direction-b/product/index.html)
  - Seller Dashboard: [`docs/design/prototypes/direction-b/dashboard/index.html`](./direction-b/dashboard/index.html)
  - Buyer Library: [`docs/design/prototypes/direction-b/library/index.html`](./direction-b/library/index.html)

- **Shared Token Stylesheet:**
  - [`docs/design/prototypes/shared.css`](./shared.css)

---

## The 7 Signature Elements Replaced

| # | Current Signature Element (Gumroad Clone) | Direction A ("Clean Marketplace") | Direction B ("Bold Brand") |
|---|---|---|---|
| **1** | **Notched price-ribbon tag** | **Rounded Price Chip:** Pill-shaped badge (`border-radius: 9999px`) in lime `#c3f351` with navy `#122540` text (11.4:1 contrast). Free products use a subtle muted chip. Clean, modern e-commerce chip convention. | **Framed Price Pill / Lime Badge:** Bold typography pill with lime fill and navy text, paired with product metadata badge. Eliminates jagged cutout shapes entirely. |
| **2** | **Product page as one box divided into cells by black lines** | **Card-based Split Layout:** Clear left content column (cover, seller info, description, included assets, rating histogram, reviews) + right sticky rounded purchase card (`border-radius: 20px`, soft `0 4px 24px rgba(18,37,64,0.12)` shadow). | **Framed Cover Mat & Bold Navy Purchase Card:** Product cover sits within a decorative dark mat framed by subtle lime/navy borders and dot pattern. Right purchase card is a bold navy card with lime primary CTA button. |
| **3** | **Discover featured carousel (cover left, black text panel right)** | **Wide Aspect Featured Card Grid:** Replaces the jarring black-box split with clean 16:9 featured card compositions directly embedded in the product grid, keeping browsing cohesive without awkward carousel layout shifts. | **Spotlight Creations with Mat Framing:** Bold headline hero + elevated framed cards with inner mat border, rating badges, and lime accents. |
| **4** | **Header: giant wordmark, wide black search bar, "Library" button, black "All" pill** | **Streamlined Sticky Nav:** Compact Arifdrop wordmark (proportional height ~32px), pill-shaped search input with subtle navy border, ghost action buttons, and a clean horizontally scrollable category chip row with soft active states. | **Navy Top Bar with Brand Dot Pattern:** Navy header band with subtle dot pattern overlay, rounded search input with white/lime focus ring, and lime-accented category pills. |
| **5** | **Hard black borders, offset hard shadows, heavy uppercase headings** | **Soft Tints & Layered Elevation:** 1px `rgba(18,37,64,0.15)` tinted borders, 10–16px border-radius, soft layered box-shadows (`0 1px 4px rgba(18,37,64,0.08), 0 4px 16px rgba(18,37,64,0.06)`), and natural sentence-case Montserrat headings. | **Vibrant Brand Contours:** 1.5px subtle navy/lime tinted borders, 16–20px radii, smooth elevation, bold typography with selective lime highlight words. |
| **6** | **Seller dashboard sidebar look** | **Slim Unified Sidebar & Top Nav:** Slim 220px desktop sidebar with subtle icon+label active states (`rgba(20,109,253,0.1)` background, royal blue text), quick-action bar above stats grid, and card-based analytics. | **Dark Navy Brand Sidebar:** 240px navy sidebar with lime active indicator bar (`border-left: 3px solid var(--lime)`), lime stat callouts, and framed metric cards. |
| **7** | **Gumroad empty-state illustrations / pink folder icons** | **Brand Pattern Geometry:** Clean geometric dot-pattern circle badges and brand pattern crops (`Arifdrop-01.jpg` derived) replacing all pink folder and cartoon illustrations. | **Framed Brand Placeholder:** Dark navy and lime dot pattern matrix with subtle geometric brand watermark. |

---

## Mobile Patterns (375px)

Both prototype directions implement two critical mobile UX patterns:

1. **Sticky Bottom Purchase Bar (Product Page):**
   - Positioned fixed at the bottom of the viewport above the tab bar.
   - Shows the price and primary CTA button ("Get this product" / "ይህን ምርት ያግኙ").
   - Meets 44px touch-target standards with high contrast.
   - Allows seamless single-tap purchase initiation while scrolling long descriptions.

2. **Mobile Bottom Tab Bar (Global Shell):**
   - 56px fixed bar with 3 essential destinations:
     - **Discover** (ያግኙ)
     - **Library** (ቤተ መፃሕፍቱ)
     - **Profile / Dashboard** (መገለጫ)
   - Uses existing translated strings only — no new string keys added.
   - Active state highlighted in Royal Blue (Direction A) or Lime (Direction B).

---

## Internationalization & Accessibility Verification

- **Amharic Typography:** Integrated with `Noto Sans Ethiopic` via Google Fonts in prototypes (mirrors self-hosted woff2 in app). Line-height set to 1.75–2.0 to prevent diacritic clipping on characters such as ጬ, ጴ, ጯ.
- **Contrast Check (WCAG AA):**
  - Primary button: Royal Blue `#146dfd` on white text = **4.6:1** (Pass AA)
  - Secondary / Focus: Blue `#2199f9` on Navy `#122540` = **6.1:1** (Pass AA)
  - Price chip: Lime `#c3f351` on Navy `#122540` = **11.4:1** (Pass AAA)
  - Dark mode surfaces: Navy `#122540` / `#0b1728` with `#f0f4f8` text = **14.2:1** (Pass AAA)
