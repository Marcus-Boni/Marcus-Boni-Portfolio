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

- **Dashboard & Audience** — first-party, cookie-less analytics: visits, unique
  visitors, devices/browsers/OS, country (by timezone), referrers, most-viewed
  sections, peak hours and a live activity feed.
- **Messages** — inbox for the site's contact form (Firestore-backed).
- **Content editing** — full CRUD over profile, projects, career timeline, tech
  stack and socials. The public site hydrates from Firestore, falling back to the
  static `src/data/profile.ts` data when Firebase is absent.

Firebase is **optional and lazy**: without env config the public site runs on the
static data and `/admin` shows a demo mode; when configured, the SDK is loaded on
demand so it never enters the public site's initial bundle. Full setup steps live
in [`ADMIN_SETUP.md`](./ADMIN_SETUP.md).

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

## Scripts

```bash
pnpm dev       # start dev server
pnpm build     # type-check + production build
pnpm lint      # eslint
pnpm preview   # preview the production build
```
