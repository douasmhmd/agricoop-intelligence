# AgriCoop UI design system

How the storefront (`apps/web`) and the back office (`apps/backoffice`) look and move, and the rules
that keep them consistent. Everything lives in **`packages/ui`** (`@agricoop/ui`, TypeScript source,
no build step): tokens in `src/styles/theme.css`, motion presets in `src/motion.ts`, components in
`src/components`, fonts in `src/fonts.ts`. The back-office route **`/styleguide`** shows every token
and component live.

**Direction:** "Moroccan olive oil, premium and authentic". The storefront tells a story (serif
headlines, photography in arch masks, faint zellige textures, generous whitespace). The back office
shares the tokens with a denser, calmer "pro dashboard" style (neutral surfaces, olive and gold
accents, crisp borders, compact tables) and animates less.

## 1. Colour

Two layers, both OKLCH:

1. **Brand scales** (static): `olive`, `gold`, `terracotta`, `sand` (50–950) and `ink`. For
   decoration only (`bg-olive-900` footer, `text-gold-500` ornaments).
2. **Semantic tokens** (switch with the theme, shadcn names): use these for all UI.

| Token                                       | Role                                     | Light                  | Dark                   |
| ------------------------------------------- | ---------------------------------------- | ---------------------- | ---------------------- |
| `background` / `foreground`                 | page, body text                          | warm sand / ink        | warm near-black / sand |
| `card`, `popover`                           | raised surfaces                          | lighter sand           | slightly lifted brown  |
| `primary`                                   | main actions, links, active nav          | deep olive (olive-700) | light olive            |
| `gold`                                      | brand accent, focus ring (`ring`)        | oil amber              | lighter amber          |
| `terracotta`                                | secondary accent                         | terracotta             | soft terracotta        |
| `muted`, `secondary`, `accent`              | quiet fills, chips, hover                | sand tints             | brown tints            |
| `success`, `warning`, `info`, `destructive` | statuses (badges, alerts, expiry levels) | AA on the page         | AA on the page         |
| `chart-1…5`                                 | olive, gold, terracotta, teal, plum      |                        |                        |
| `sidebar*`                                  | back-office sidebar                      |                        |                        |

- **Dark mode** is warm (brown-black, never pure black): `.dark` on `<html>`, set by `ThemeProvider`
  (light / dark / system) and applied before paint by `public/theme-init.js` (no flash; the CSP
  forbids inline scripts).
- **Contrast:** `packages/ui/test/contrast.test.ts` computes WCAG AA for 40 text/background pairs in
  both themes straight from `theme.css`. Run it after any colour change.
- Never use raw palette colours (`bg-red-100`, `text-amber-900`): they ignore the theme. The only
  exceptions are text over photos (`text-white`, `from-black/60` scrims) and the dark footer.

## 2. Typography

| Family                | Use                                  | Font                                                    |
| --------------------- | ------------------------------------ | ------------------------------------------------------- |
| `font-display`        | headings, big figures                | Fraunces (variable, optical size)                       |
| `font-sans` (default) | UI and body                          | Manrope (variable)                                      |
| Arabic (automatic)    | falls through when glyphs are Arabic | Noto Kufi Arabic (display), IBM Plex Sans Arabic (body) |

- Self-hosted with Fontsource (`font-display: swap`, `unicode-range` subsets: Arabic files load only
  on Arabic pages).
- **Fluid display scale** `text-display-sm … text-display-2xl` (`clamp()`, 360 → 1920 px) for
  headlines; body and UI stay on Tailwind's fixed scale (`text-sm`, `text-base`).
- Arabic body text gets `line-height: 1.7`. **No letter-spacing on RTL pages** (`theme.css` resets it
  under `[dir=rtl]`): tracking breaks the joining of Arabic letters.
- Class names must be literal in the source (`text-display-lg`), never built with template strings
  (Tailwind only emits classes it can see).

## 3. Shape, depth and texture

- **Radii:** `--radius` 14 px (cards); `rounded-md` 10 px (inputs, buttons); `rounded-xl` / `2xl` for
  sheets and dialogs; `rounded-full` for chips and badges.
- **Elevation:** three warm, layered shadows: `shadow-soft` (cards), `shadow-lifted` (hover, menus),
  `shadow-float` (dialogs, hero media).
- **Brand utilities:** `zellige` (8-point star lattice in `currentColor`; use through
  `<ZelligeBackdrop>` on hero, footer and empty states), `grain` (film-grain overlay), `arch`
  (Moroccan arch mask for images), `glass` (sticky header and overlays only), `hairline-gold`
  (divider; `<Ornament>`).

## 4. Components (`@agricoop/ui`)

Button, Input/Textarea, Label, Card, Badge (tinted variants, `dot`, striped `synthetic`), Dialog,
Sheet (logical `side="start" | "end"`), Table (sticky header, hairline rows, hover), Skeleton
(shimmer), Tabs (sliding indicator), DropdownMenu, Switch, Toaster (Sonner, brand-styled), Accordion,
Command (cmdk palette), Picture (lazy, blur-up, branded fallback), BrandMark, Ornament,
ZelligeBackdrop, ThemeToggle. Import them from `@agricoop/ui`; never copy them into an app.

**Back-office page patterns** (`apps/backoffice/src/components/data.tsx`, `confirm.tsx`): `DataCard`

- `Table` for lists, `TableSkeleton` while loading, `EmptyState` (icon, title, action) when empty,
  `FilterChip`/`FilterBar` for filters, `RowActions` for the row "⋯" menu, `StatusBadge tone` for
  statuses, `ExpiryBar` for days to expiry, `useConfirm()` instead of `window.confirm`, `Field` for
  labelled controls (linked, animated validation). On phones, hide secondary columns with
  `max-md:hidden` instead of making the table scroll.

## 5. Motion

All motion comes from **`packages/ui/src/motion.ts`**; never hand-write durations or curves.

| Preset                                     | Value                                          | Use                                  |
| ------------------------------------------ | ---------------------------------------------- | ------------------------------------ |
| `duration.fast / base / slow`              | 150 / 220 / 300 ms                             | UI feedback                          |
| `duration.reveal / hero`                   | 600 / 800 ms                                   | scroll reveals, hero headline        |
| `ease.out` (= CSS `ease-out-expo`)         | `cubic-bezier(.16, 1, .3, 1)`                  | default curve                        |
| `spring.snappy / soft / bouncy`            | stiff toggles / dialogs and cards / cart badge |                                      |
| `transition.ui / fast / reveal / hero`     | duration + curve bundles                       | `transition={transition.reveal}`     |
| `fade`, `fadeUp`, `fadeUpSmall`, `scaleIn` | variants (`hidden → visible → exit`)           | entrances, validation messages       |
| `slideInFromStart / End`                   | variants, `custom={dir}`                       | horizontal entrances (mirror in RTL) |
| `stagger(each)`, `wordReveal`              | parent / child variants                        | lists, hero headline word by word    |
| `press`                                    | `whileTap` scale 0.97                          | pressable elements                   |
| `revealViewport`                           | `{ once: true, margin: -12% }`                 | `whileInView` scroll reveals         |

Rules:

1. **Only `transform` and `opacity`** are animated (no width/height/top/left). Progress bars grow with
   `scaleX` from `origin-left rtl:origin-right`. The one exception is the back-office sidebar width
   (CSS transition, asked for by the design).
2. **RTL:** horizontal offsets go through `inlineOffset(px, dir)` or `custom={dir}` with
   `useDirection()`, so they flip in Arabic. Directional icons get `rtl:rotate-180`.
3. **Reduced motion** (`prefers-reduced-motion: reduce`) keeps fades only:
   - Motion: `<MotionProvider>` wraps both apps in `MotionConfig reducedMotion="user"`; style-bound
     values (parallax) check `useReducedMotion()` themselves; confetti and fly-to-cart are skipped.
   - CSS (`theme.css`): shimmer, float and view transitions stop; tw-animate-css entrances (dialogs,
     sheets, menus, accordion) lose their translate/scale/rotate; transform transitions (hover
     nudges, switch thumb, sidebar width) become instant; smooth scrolling is off.
   - Lenis smooth scroll (storefront only) is not started.
4. **Scroll reveals** use `whileInView` with `revealViewport` (play once). Heavy sections are lazy.
5. **The back office animates less** than the storefront: short entrances (`fadeUpSmall`,
   `stagger(0.05)`), no parallax, no word reveals.
6. **Route changes** use the View Transitions API (short cross-fade; the product image morphs from
   card to page through a shared `view-transition-name`, with a Motion `layoutId` fallback).

## 6. RTL (Arabic)

- `<html dir>` follows the language; components read it with `useDirection()` (kit) and the back
  office passes it to Radix (`Direction.Provider`) so menus, tabs and sheets align and use the arrow
  keys correctly.
- Logical utilities only: `ms-/me-/ps-/pe-`, `start-/end-`, `text-start/end`, `border-s/e`,
  `rounded-s/e`. Physical ones (`ml-`, `left-`, `text-left`) only for symmetric centring.
- Charts and time axes stay left-to-right (`dir="ltr"` on the chart), like numbers and codes
  (`dir="ltr"` on phone numbers, signed quantities, product codes in inputs).
- Offsets that must not apply on desktop use `max-lg:` (an unscoped `rtl:` variant beats `lg:`).

## 7. Accessibility and quality bar

- Focus: a 2 px gold `:focus-visible` outline on every surface (`--ring` is dark enough for 3:1).
- Radix primitives keep their ARIA and keyboard behaviour; the command palette, drawers and dialogs
  are fully keyboard-operable.
- Text pairs meet WCAG AA in both themes (contrast test).
- Layout is checked at 390 px and 1440 px in light/dark × FR/AR by the visual suite, which fails on
  any horizontal scroll: `pnpm --filter @agricoop/e2e screenshots` (`VISUAL_PHASE`, and
  `VISUAL_USER=manager.coop01` for the back office on the shared seed) →
  `apps/e2e/screenshots/redesign/<phase>/`.
- Lighthouse targets for the storefront home on mobile: Performance ≥ 90, Accessibility ≥ 95
  (results in section 8).

## 8. Lighthouse

Storefront home, **production image** (`docker compose --profile apps`, nginx), Lighthouse 13.6
mobile defaults (simulated slow 4G, 4× CPU), 2026-11-17:

| Category       | Before phase 6 | After (3 runs)           |
| -------------- | -------------- | ------------------------ |
| Performance    | 47             | 79 / 82 / 93 (median 82) |
| Accessibility  | 100            | 100                      |
| Best practices | 96             | 100                      |
| SEO            | 83             | 100                      |

First paint 7.5 s → 3.4 s (2.0 s on the best run), LCP 7.5 s → 3.4 s, total blocking time
460 → ~220 ms, CLS ≈ 0. What changed:

- **nginx gzip** (`apps/docker/nginx-spa.conf.template`): JS and CSS were sent uncompressed
  (~950 KB → ~310 KB on the wire).
- The hero paragraph (the LCP element) is no longer faded in; the headline keeps its word reveal.
- Below-the-fold home sections use `defer-render` (`content-visibility: auto`).
- The cart drawer UI loads on first open (prefetched on cart-button hover/focus); Lenis loads when
  the browser is idle.
- Photo `srcset` has intermediate widths (480, 800) so phones fetch closer to the displayed size.
- Zod runs jitless in browsers (`packages/shared/src/zod-config.ts`): its `new Function` check was a
  CSP violation in production.
- `meta description`, `robots.txt` (QR links `/v/…` carry a secret token: never indexed), language
  buttons whose accessible name contains their visible text.

**Remaining gap to 90 (median):** the storefront is client-rendered, so nothing paints until
~280 KB of gzipped JS (React, router, Motion, Zod, i18next, OIDC client) has downloaded and run.
Reaching ≥ 90 reliably needs the home page's first screen in the HTML (pre-rendering / SSG of the
hero), a separate architectural change.

How to re-run: build and start the image (`docker compose -f docker-compose.yml -f
docker-compose.apps.yml --profile apps up -d --build web`, it takes port 5173), then run
Lighthouse against `http://localhost:5173/` (on Windows, through a Chromium started by
Playwright with `--remote-debugging-port`, since chrome-launcher cannot spawn Chrome there).
