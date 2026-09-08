# Marcus Boni — Portfolio

[![Netlify Status](https://api.netlify.com/api/v1/badges/748366c2-9f80-4f75-8656-f33bd0131b0a/deploy-status)](https://app.netlify.com/projects/marcusboni/deploys)

> **Signal & Ink** — an avant-garde, editorial-brutalist portfolio for a Brazilian
> software engineer. Warm near-black canvas, bone-white typography, a single
> burnt-ember accent, and a WebGL ink field that reacts to your pointer and
> scroll velocity.

## Design concept

- **Palette:** `ink #0d0c0a` · `bone #ece7df` · `ember #ff4d17` — one dominant
  dark, one accent, nothing else.
- **Typography:** Instrument Serif (display, italic for emphasis) ×
  Archivo Variable (structural sans, width axis) × Fragment Mono (labels/data).
- **Navigation:** no conventional navbar — a fixed vertical *section rail* on
  the left edge plus a full-screen serif menu overlay.
- **Signature moments:** GLSL domain-warped ink hero, custom contextual cursor
  (`VER` / `VIEW` / `ARRASTE` states), scroll-driven horizontal work gallery,
  velocity-aware shader energy, editorial marquees, grain overlay.
- **Bilingual:** PT-BR / EN toggle in the header. All copy lives in
  `src/i18n/translations.tsx` (typed, JSX-capable); the choice persists in
  `localStorage` and re-runs every text reveal on switch.

## Stack

| Layer | Tech |
| --- | --- |
| Core | React 19 · Vite 8 · TypeScript (strict) |
| Styling | Tailwind CSS v4 (`@theme` tokens) · clsx · tailwind-merge · shadcn/ui conventions |
| Scroll | Lenis (`lenis/react`, driven by the GSAP ticker) |
| Animation | GSAP (ScrollTrigger, CustomEase) · SplitType · Framer Motion |
| 3D / Shaders | Three.js · React Three Fiber · @react-three/drei · custom GLSL |
| Admin / Data | React Router · Firebase Auth + Firestore (lazy, env-gated) |

## Admin area (`/admin`)

A full back-office for the portfolio, behind Firebase Auth:

- **Dashboard & Audience** — first-party, cookie-less analytics with a
  selectable window (24h / 7d / 30d / 90d), every figure compared against the
  preceding window of equal length: visits, unique visitors, sessions, bounce
  rate, session duration, top pages, traffic sources, devices/browsers/OS,
  country (by timezone), a weekday × hour heat map, blog read-through rates, and
  CSV export. Every chart ships a table twin. Metric definitions and the colour
  rationale are in [`docs/ANALYTICS.md`](./docs/ANALYTICS.md).
- **Messages** — inbox for the site's contact form (Firestore-backed).
- **Content editing** — full CRUD over profile, projects, career timeline, tech
  stack and socials. The public site hydrates from Firestore, falling back to the
  static `src/data/profile.ts` data when Firebase is absent.

Firebase is **optional and lazy**: without env config the public site runs on the
static data and `/admin` shows a demo mode; when configured, the SDK is loaded on
demand so it never enters the public site's initial bundle. Full setup steps live
in [`ADMIN_SETUP.md`](./ADMIN_SETUP.md).

## Blog (`/blog`)

A technical journal — market studies, project write-ups, notes worth sharing in
a meeting. Posts are written in Markdown from `/admin/blog` (split-pane editor
with a live preview that uses the published post's own CSS) and stored in
Firestore; images are downscaled and re-encoded to WebP **in the browser**
before reaching Storage, in three widths plus a blur-up placeholder.

- **Rich embeds** via Markdown directives — callouts, pull quotes, galleries,
  a click-to-load YouTube facade, short self-hosted clips, GitHub repo cards.
  Raw HTML is never evaluated.
- **Code** highlighted by Shiki in a theme derived from the site's own palette,
  with per-language grammars loaded on demand.
- **Per-post SEO** injected at the edge (`netlify/edge-functions/blog-meta.ts`),
  because social crawlers do not run JavaScript — plus a live `/rss.xml` and
  `/sitemap.xml` generated from Firestore, so publishing needs no rebuild.
- **Three visibility levels**: `draft`, `unlisted` (direct link only, out of the
  index/RSS/sitemap) and `published`.

Setup, authoring syntax and the chunking rules are in [`docs/BLOG.md`](./docs/BLOG.md).

## Agent readiness

The site is built to be read by programs as well as people:

- **Real 404s** — `public/_redirects` enumerates the routes instead of ending in
  a catch-all, so an unknown path gets a genuine 404 and `public/404.html`
  rather than the app shell with a 200. A `/blog/:slug` that Firestore does not
  have returns 404 too.
- **Content without JavaScript** — `index.html` ships the substance of the page
  (projects, client work, stack, contact, links) in plain HTML, below the fold
  and replaced by React on mount.
- **Markdown content negotiation** — every HTML page answers
  `Accept: text/markdown` from the same URL with `Vary: Accept`, per
  [acceptmarkdown.com](https://acceptmarkdown.com). Posts are authored in
  Markdown, so their Markdown representation is the source, not a conversion.
- **[`/developers`](https://marcusboni.com.br/developers)** — a standalone,
  bundle-free portal documenting every machine-readable endpoint with `curl`
  examples, plus [`/agent-instructions.md`](https://marcusboni.com.br/agent-instructions.md)
  and a "when to use this" section in `llms.txt`.

The design, the traps and the verification commands are in
[`docs/AGENTS.md`](./docs/AGENTS.md).

## Architecture

```
src/
├── animations/
│   ├── gsap.ts              # plugin registration, signature CustomEase
│   └── glsl/inkField.ts     # hero vertex + fragment shaders
├── components/
│   ├── canvas/              # R3F scenes (lazy-loaded)
│   ├── cursor/              # custom DOM cursor
│   ├── layout/              # SmoothScroll (Lenis), Header, SectionRail
│   ├── sections/            # Hero, About, Work, Stack, Contact
│   └── ui/                  # button (shadcn-style), Marquee, SectionHeading
├── admin/                   # /admin SPA: auth, layout, pages, charts, services
├── blog/                    # /blog SPA: pages, Markdown renderer, directives
├── content/                 # SiteContent types/defaults + Firestore hydration
├── data/profile.ts          # structural content (projects, stack, socials)
├── i18n/                    # LanguageContext + typed PT/EN translations
├── hooks/                   # useScrollReveal, useMagnetic, usePointer, …
├── lib/                     # cn(), scroll-state, firebase, analytics, messages
└── styles/index.css         # Tailwind v4 tokens + base + utilities
```

### Performance notes

- The Three.js bundle is split into its own chunk and only loads with the
  lazy `InkFieldScene`; initial JS stays lean.
- Lenis, GSAP and R3F share a single `gsap.ticker` clock; scroll state crosses
  into the shader via a mutable module (no React re-renders at 60fps).
- Canvas DPR is capped at 1.75, antialias off (the grain hides it).
- Horizontal work gallery only pins on `lg+`; touch devices get a vertical stack.
- `prefers-reduced-motion` disables Lenis, SplitType reveals and the WebGL
  scene (static gradient fallback).
- The home page loads exactly four static chunks (`rolldown-runtime`, `react`,
  `router`, `motion`); the blog and admin add none. Verify after any chunking
  change with `grep -o 'modulepreload[^>]*href="/assets/[^"]*"' dist/index.html`
  — see the traps listed in [`docs/BLOG.md`](./docs/BLOG.md#5-arquitetura).

## Scripts

```bash
pnpm dev         # start dev server
pnpm build       # type-check (app, node, tests + netlify/) + production build
pnpm lint        # eslint
pnpm test        # vitest — edge functions, routing, machine-readable files
pnpm test:watch  # vitest in watch mode
pnpm preview     # preview the production build
```

`pnpm preview` serves `dist` through Vite, which has its own SPA fallback and
reads neither `_redirects` nor the edge functions — `/nope` answers 200 there
and 404 in production. Trust `pnpm test` for that behaviour, not the preview.
