# PDF Invoice Font Configuration & Ethiopic Glyph Rendering

## Overview

PDF invoices are generated via `PDFKit`, which interfaces with `wkhtmltopdf` (a headless WebKit rendering engine).

Because `wkhtmltopdf` renders HTML directly on the server without a full browser context, it relies on system-level fonts installed on the host operating system rather than remote web fonts. If Ethiopic fonts are missing from the system font directory, `wkhtmltopdf` will fail to render Amharic glyphs, resulting in missing characters or "tofu" squares (`□`).

## System Font Requirements

To ensure Ethiopic glyphs (Unicode U+1200–U+137F) render correctly in PDF invoices:

### 1. Docker / Production Containers (Debian Bookworm)

`fonts-noto-core` provides `Noto Sans Ethiopic` and is included in the base package installation in `Dockerfile`:

```dockerfile
RUN apt-get update -qq && \
    apt-get install -yq --no-install-recommends \
      ...
      fonts-dejavu \
      fonts-noto-core \
      ...
```

### 2. Local Linux Development (Ubuntu / Debian)

Install the package via `apt`:

```bash
sudo apt-get install fonts-noto-core
```

Or install the full Noto package:

```bash
sudo apt-get install fonts-noto-extra
```

### 3. macOS Development

macOS includes native Ethiopic fonts (`Noto Sans Ethiopic`, `Kefa`). If needed, install via Homebrew font casks:

```bash
brew tap homebrew/cask-fonts
brew install font-noto-sans-ethiopic
```

## Template Font Stack

In `app/views/purchases/invoices/create.pdf.erb`, the CSS font-family stack is configured as:

```css
font-family:
  "Noto Sans Ethiopic",
  "Abyssinica SIL",
  Nyala,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  Roboto,
  Helvetica,
  Arial,
  sans-serif;
```

When `wkhtmltopdf` parses this stylesheet, it resolves `Noto Sans Ethiopic` from the installed system font cache (`/usr/share/fonts/truetype/noto/NotoSansEthiopic-*.ttf`).

## Docker Container Verification

Verification executed in the Debian Bookworm (`ruby:3.4.3-bookworm`) environment:

1. Package installation:
   `apt-get update && apt-get install -y --no-install-recommends fonts-noto-core fontconfig wkhtmltopdf`
2. Font discovery verification:
   `fc-list : family | grep Ethiopic`
   Outputs:
   - `Noto Sans Ethiopic`
   - `Noto Serif Ethiopic`
3. Glyph test generation:
   PDF rendering was verified using an HTML fixture containing Amharic header strings (`የክፍያ ደረሰኝ`, `የክፍያ መረጃ`, `የምርት ዋጋ`) and Unicode block U+1200–U+137F; the rendered PDF confirmed that all Ethiopic characters render crisply with no missing glyphs or replacement squares (`□`).
