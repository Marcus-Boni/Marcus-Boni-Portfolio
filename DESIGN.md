# Design

## Source of truth
Status: Active. Date: 2026-11-16. Scope: the home page (hero, about, work, experience, stack, contact, section rail, marquees) and the journal at `/blog` (index and post). The admin area keeps its own conventions. Evidence: section components, `src/blog`, translations, `src/styles/index.css`, and browser checks at 1280×800 and 375×812.

## Brand
Editorial, precise and personal. Signal & Ink: a warm near-black page, bone type, one ember accent. Serif statements, a structural sans, mono for labels and data. Figures on the site are drawn by code: the author's portrait (fig. 01), the stack (fig. 02), and a contour plate for each journal entry. Avoid proficiency meters and unsupported skill claims.

## Product goals
Let a recruiter, a peer or a client scan the complete stack by discipline in one screen and understand each area. Keep the page from feeling long: the stack section fits one viewport and the project gallery costs less scroll than it is wide. Make the journal read as a working notebook that shows engineering craft, and look finished even with no entries published.

## Personas and jobs
Assumed audiences: recruiters assessing a stack, technical peers looking for tools and write-ups, and clients looking for engineering capabilities. Contexts: notebook browsing, mobile reading and keyboard navigation.

## Information architecture
Home keeps its six section ids and the section rail. The stack uses the CMS categories frontend, backend, data and ops, shows every technology by default and links to project evidence; discovery never depends on opening a panel. The journal index is a ledger: masthead figures, URL-backed filters, one featured entry, then numbered and dated rows. A post carries a masthead, the article, a reading rail and related entries.

## Design principles
Favor recognition and scanning. Explain practical domains alongside tool names. One authored motion moment per surface; supporting motion explains state or position. Numbers on screen are derived from real data (entry count, reading minutes, position in a gallery). Nothing is available on hover only.

## Visual language
Tokens: ink, ink-soft, bone, bone-dim, smoke, ember, ember-deep, line. Instrument Serif for statements and titles, Archivo for structure and group titles, Fragment Mono for labels, ordinals and measurements. Flat hairline borders, no shadows on content, no gradients on type. Ember marks the active or the single accent in a figure, never a fill for default states. Focus rings, selection and the text caret use ember.

## Components
Stack: statement, context, link to projects, and fig. 02, an exploded isometric view of four layers. Each layer is a plane with a geometric drawing of its domain, a callout bracket, a title, a description and a plain-text list of technologies. Planes separate with the scroll; a signal travels the axis and lights each layer; hover lights a layer. Work: pinned horizontal gallery with a position readout (current / total and a progress hairline). Section rail: numbered ticks in the gutter, the active section's name set vertically on the page edge, other names on hover or focus. Marquee: runs faster and leans with scroll velocity. About: the statement inks in word by word as it is read. Journal: `PostPlate` (contour map seeded by the slug, used as cover fallback), `FeaturedPostCard`, `PostRow`, `RelatedCard`, masthead figures with count-up, `ReadingStatus`, `TableOfContents`, `MobileReadingBar`. Reuse `SectionHeading`, `HoverItalic`, `Button`.

## Accessibility
Target WCAG 2.2 AA. Maintain headings, lists, visible focus and usable link targets. Technology labels are content, not controls. Figures, plates and the axis are `aria-hidden`; their information is in the text beside them. Reduced motion: scroll-linked and looping motion stops, plates paint once, counts show their final value, state changes stay instant and legible. Loops run only while on screen and while the tab is visible.

## Responsive behavior
Mobile: one column. The stack figure keeps its axis with small planes and no drawings; technology lists wrap with trailing separators. From 640px the planes grow; from 1024px the statement sits beside the figure and the rail appears. Journal rows drop the plate and the margin date below 768px and fold the date into the meta line; the reading rail becomes a bar docked to the bottom edge below 1280px. Short notebooks: reduced vertical spacing in the project gallery, with travel measured against the real track.

## Interaction states
Render CMS defaults immediately, then update from live content. Derive stack groups from content and omit empty categories. Journal: skeleton rows while loading, retry on error, an authored empty state (plate, RSS and home links) with no entries, and a clear-filters action when filters match nothing. Never fabricate absent technologies or entries; sample entries exist only behind the development flag.

## Content voice
Portuguese and English through `src/i18n/translations.tsx`. Explain domains without inventing proficiency. Stack group labels: Interfaces, Serviços & APIs, Dados and Infraestrutura. Journal entries are "registros"; their ordinal reads "Nº 007".

## Implementation constraints
React, Tailwind v4, GSAP (ScrollTrigger, CustomEase), Lenis, SplitType and Canvas 2D for plates. No new runtime dependencies; external component libraries are references to port from (`docs/UI_REFERENCES.md`). The home must keep its four static chunks. No CMS schema changes. Validate with build, lint, tests and browser checks on notebook and mobile.

## Open questions
Entry ordinals follow publication order, so unpublishing an old entry renumbers the ones after it; a stored ordinal would fix that at the cost of a schema change. Experience remains a long vertical ledger and is the next candidate if the page still feels long.
