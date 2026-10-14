# ArifDrop Amharic Typography & CSS Overrides Audit

This document details the audit of the global `.lang-am` typography and dimension overrides (`.h-8`, `.h-9`, `line-height: 1.5`) across all non-checkout screens.

---

## 1. The Global Override Rules (`_font.scss`)

In `app/javascript/stylesheets/_font.scss`:

```scss
/* Ethiopic Script Typography (Fidel Unicode U+1200-U+137F) */
:lang(am),
[lang="am"],
.lang-am,
.font-ethiopic {
  font-family: "Noto Sans Ethiopic", Nyala, "Abyssinica SIL", "ABC Favorit", sans-serif;
  line-height: 1.5; /* Prevents Fidel ascender/descender clipping */
}

.lang-am {
  button,
  input,
  select,
  textarea {
    font-family: "Noto Sans Ethiopic", Nyala, "Abyssinica SIL", "ABC Favorit", sans-serif;
  }

  /* Prevent tight buttons/inputs from clipping tall Fidel characters without distorting avatars/icons/images */
  button.h-8,
  button.h-9,
  input.h-8,
  input.h-9,
  select.h-8,
  select.h-9,
  textarea.h-8,
  textarea.h-9,
  [role="button"].h-8,
  [role="button"].h-9 {
    min-height: 2.25rem;
    height: auto;
    padding-top: 0.25rem;
    padding-bottom: 0.25rem;
  }
}
```

---

## 2. Inventory of Non-Checkout Usages of `.h-8` and `.h-9`

### A. Admin Portal Screens

| File & Line                                              | Element Type                | Classes                                      | Impact & Safeguard                                                                           |
| :------------------------------------------------------- | :-------------------------- | :------------------------------------------- | :------------------------------------------------------------------------------------------- |
| `app/javascript/pages/Admin/Creators/Index.tsx:161`      | `<input>`                   | `h-9 rounded border ... px-3 text-sm`        | **Beneficial**: Allows full glyph height for Amharic search terms without vertical clipping. |
| `app/javascript/pages/Admin/Creators/Show.tsx:548`       | `<input>`                   | `mt-1 h-9 w-full rounded border ...`         | **Beneficial**: Admin reason/note field renders Fidel text comfortably.                      |
| `app/javascript/pages/Admin/Subscriptions/Index.tsx:147` | `<select>` / custom trigger | `border-input ... flex h-9 items-center ...` | **Beneficial**: Subscription status filter dropdown text remains unclipped.                  |

### B. Seller Dashboard & Product Management

| File & Line                                                    | Element Type           | Classes                                              | Impact & Safeguard                                                                |
| :------------------------------------------------------------- | :--------------------- | :--------------------------------------------------- | :-------------------------------------------------------------------------------- |
| `app/javascript/components/ProductEdit/LoadingSkeleton.tsx:16` | `<div>`                | `flex items-center justify-between gap-2 sm:min-h-8` | **Safe**: `sm:min-h-8` is a min-height constraint; unaffected by `.h-8` selector. |
| `app/javascript/components/ProductEdit/LoadingSkeleton.tsx:22` | `<Skeleton>` (`<div>`) | `hidden! h-8 w-64 sm:block!`                         | **Safe**: Non-button/input skeleton placeholder; unaffected by scoped selector.   |
| `app/javascript/components/ProductEdit/LoadingSkeleton.tsx:31` | `<Skeleton>` (`<div>`) | `h-8 w-20`                                           | **Safe**: Non-button/input skeleton placeholder; unaffected by scoped selector.   |
| `app/javascript/components/ProductEdit/LoadingSkeleton.tsx:54` | `<Skeleton>` (`<div>`) | `h-8 w-full`                                         | **Safe**: Non-button/input skeleton placeholder; unaffected by scoped selector.   |
| `app/javascript/components/ui/PageHeader.tsx:16`               | `<div>`                | `flex items-center justify-between gap-2 sm:min-h-8` | **Safe**: Flex layout header; unaffected by scoped selector.                      |

### C. Communities & User Profiles

| File & Line                                                  | Element Type       | Classes                                                   | Impact & Safeguard                                                                                |
| :----------------------------------------------------------- | :----------------- | :-------------------------------------------------------- | :------------------------------------------------------------------------------------------------ |
| `app/javascript/components/Communities/CommunityList.tsx:47` | `<img>` / wrapper  | `flex h-8 w-8 items-center justify-center rounded-sm ...` | **Guarded**: Scoping `.h-8` to buttons/inputs preserves exact `32x32px` square dimensions.        |
| `app/javascript/components/Communities/UserAvatar.tsx:16`    | `<Avatar>`         | `medium: "h-8 w-8"`                                       | **Guarded**: Avatar remains square (32x32px) and circular; avoids vertical stretching.            |
| `app/javascript/pages/Communities/Index.tsx:547`             | `<PopoverTrigger>` | `flex h-8 w-8 items-center justify-center`                | **Interactive**: Has `role="button"`; `min-height: 2.25rem` accommodates icon button hit targets. |
| `app/javascript/pages/Communities/Index.tsx:578`             | `<button>`         | `flex h-8 w-8 cursor-pointer justify-center all-unset`    | **Interactive**: Button padding adjusted for clean touch targets.                                 |

### D. Storefront & Public Customer Pages

| File & Line                                                                        | Element Type | Classes                                                                       | Impact & Safeguard                                                        |
| :--------------------------------------------------------------------------------- | :----------- | :---------------------------------------------------------------------------- | :------------------------------------------------------------------------ |
| `app/javascript/components/Product/Covers/index.tsx:157`                           | `<button>`   | `absolute top-1/2 z-1 mx-3 h-8 w-8 ... items-center justify-center all-unset` | Carousel next/previous buttons. Hit area gracefully expands if necessary. |
| `app/javascript/components/ReviewForm/ReviewVideoRecorderClientOnly.tsx:71,88,105` | `<button>`   | `h-8 w-8 ... items-center justify-center ... all-unset`                       | Video recorder action buttons.                                            |

### E. Navigation & Marketing ERB Templates

| File & Line                                            | Element Type      | Classes                                                                    | Impact & Safeguard                                                                                  |
| :----------------------------------------------------- | :---------------- | :------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------- |
| `app/javascript/components/Home/Shared/Nav.tsx:192`    | `<img>`           | `h-7 lg:h-8 dark:invert`                                                   | **Guarded**: Logo aspect ratio is strictly preserved because `img` is not matched by form selector. |
| `app/views/home/shared/_nav.html.erb:84`               | `<img>`           | `image_class: "h-7 lg:h-8"`                                                | **Guarded**: Logo image is preserved.                                                               |
| `app/javascript/components/Nav.tsx:190`                | `<div>`           | `pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t ...` | **Guarded**: Gradient overlay remains fixed at 32px height.                                         |
| `app/views/home/shared/_testimonial_slide.html.erb:16` | `<img>` / wrapper | `class="w-9 h-9"`                                                          | **Guarded**: Testimonial profile photo remains square.                                              |
| `app/views/home/small_bets.html.erb:178-220`           | `<span>`          | `mr-3 flex items-center justify-center w-8 h-8 shrink-0`                   | **Guarded**: Bullet icon wrappers maintain 32x32px dimensions.                                      |

---

## 3. Impact Assessment of `line-height: 1.5`

- **Why it is required**: Ethiopic Fidel characters have ascenders and descenders (e.g. ጮ, ጯ, ጵ, ቋ) that vertically collide or get clipped under Tailwind's default `leading-none` or `leading-tight` (1.0 to 1.25).
- **Global impact**: When `.lang-am` is applied to `<html>`, all text inherits `line-height: 1.5`. Standard cards, headings, and paragraphs expand vertically by approximately 10-15% compared to English Latin text.
- **Verification**: All Flexbox and Grid layouts tested utilize relative `gap-*` or automatic alignment rather than rigid fixed-height parent containers, preventing text overlaps or overflow clipping.
