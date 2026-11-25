I used to save these links in different places. This entry exists so I can
stop: it is the list of what I open when I want to build a front end that looks
good, feels modern and reads like a product, and it is where I will come back
myself.

There are seventeen addresses on six shelves: the base nearly everything installs
onto, the component collections, the motion libraries, 3D, the skills that give
a coding agent design judgment, and research into a client's brand. All of them
can be used for free. Where there is a paid plan or a license condition, a note
says so.

:::takeaways
- shadcn/ui is the base: the five collections here install with the same command.
- A collection is a repertoire. I study the pattern and take into the project only what it needs.
- One library per job: GSAP choreographs the scroll, Lenis smooths it, Motion handles state and Anime.js covers the page with no framework.
- 3D is the last layer. Three.js comes in when the idea needs real depth, and it loads only after the page is already standing.
- A skill does not design for me. It gives the agent a vocabulary and gives me a ruler to review what came out.
- A client project starts with the client's brand. Research comes before the first component.
- Before copying, three checks: license, reduced motion and bundle weight.
:::

:::callout{type=tip title="The kit in one link"}
The seventeen addresses also live on a page of their own, to open, share and download: bookmarks that land in your browser as one folder, the list in Markdown and the command that installs the skills. [marcusboni.com.br/en/kit/front-end](/en/kit/front-end)
:::

## The map

If all you want is the right address, the table is enough. The rest of the entry
explains each row.

| Tool | I open it when | License |
| --- | --- | --- |
| [shadcn/ui](https://ui.shadcn.com/) | I need the base: button, dialog, form | MIT |
| [React Bits](https://www.reactbits.dev/get-started/introduction) | I want animated text, a background or a card | MIT + Commons Clause |
| [Skiper UI](https://skiper-ui.com/components) | I am after a scroll or cursor interaction | Free with attribution |
| [Componentry](https://componentry.dev/docs) | the subject is scroll, kinetic type or WebGL | MIT |
| [KokonutUI](https://kokonutui.com/docs/ai/ai-token-alternatives) | the screen belongs to an AI product | MIT |
| [Bklit UI](https://bklit.com/) | I need a chart | MIT |
| [GSAP](https://gsap.com/) | scroll drives the animation | Free, own license |
| [Lenis](https://lenis.dev/) | the page calls for smooth scrolling | MIT |
| [Motion](https://motion.dev/docs) | the movement depends on React state | MIT |
| [Anime.js](https://animejs.com/documentation/) | I want a timeline with no framework | MIT |
| [Three.js](https://github.com/mrdoob/three.js/) | the idea calls for 3D: model, scene, shader | MIT |
| [Impeccable](https://impeccable.style/docs/impeccable/) | I am reviewing or refining an interface with the agent | Apache 2.0 |
| [Taste Skill](https://www.tasteskill.dev/) | the agent is building a site from scratch | MIT |
| [emilkowalski/skills](https://github.com/emilkowalski/skills) | the subject is interface animation | MIT |
| [UI Skills](https://www.ui-skills.com/) | I want concrete constraints for UI, accessibility and motion | MIT |
| [research](https://github.com/mattpocock/skills/tree/main/skills/engineering/research) | I need to map out a client's brand | MIT |
| [Firecrawl](https://www.firecrawl.dev/) | the agent needs to read the client's site | AGPL-3.0 |

## The base: shadcn/ui

[shadcn/ui](https://ui.shadcn.com/) does not enter the project as a dependency.
The command line copies each component's code into the repository, and from then
on it is yours: you can read it, restyle it and delete what is left over. Its
own documentation warns that it is not a component library but the way you build
yours.

```bash title="terminal"
npx shadcn@latest init
npx shadcn@latest add button
```

What makes it the base of this list is the **registry**: an address that serves
components in the format that command line understands. Anyone can publish one,
and the five collections in the next section did.[^mcp] Componentry, KokonutUI
and Bklit each ask for one line in `components.json`:

```json title="components.json"
{
  "registries": {
    "@componentry": "https://componentry.dev/r/{name}.json",
    "@kokonutui": "https://kokonutui.com/r/{name}.json",
    "@bklit": "https://ui.bklit.com/r/{name}.json"
  }
}
```

From there, installing is always the same command with a different prefix. These
are the examples each documentation prints:

```bash title="terminal"
npx shadcn@latest add @react-bits/SplitText-TS-TW
npx shadcn@latest add @skiper-ui/skiper40
npx shadcn@latest add @kokonutui/ai-token-alternatives
npx shadcn@latest add @bklit/area-chart
```

## Component collections

I install none of them whole. I use them as a repertoire: I open one with a
question in mind (how do I show reading progress? how do I reveal a heading?),
look at how two or three solved it and decide whether to install the component
or rewrite the pattern with what the project already has.

### React Bits

[React Bits](https://www.reactbits.dev/get-started/introduction) is an open
library of more than two hundred animated React components, across text,
animations, components and backgrounds.[^reactbits] Each comes in four variants:
JavaScript or TypeScript, plain CSS or Tailwind. It is where I start when I want
a heading that reveals itself, a textured background or a card that reacts to
the cursor.

### Skiper UI

[Skiper UI](https://skiper-ui.com/components) is a registry of React and
Tailwind components, part free and part paid.[^skiper] The free ones I look at
most are about scroll and cursor: a progress bar, text that reveals as the page
moves down, a stack of cards.

### Componentry

[Componentry](https://componentry.dev/docs) ships its components as editable
source code, focused on scroll, kinetic typography and WebGL effects. The idea
for the notes that accompany this entry came from there.[^componentry]

### KokonutUI

[KokonutUI](https://kokonutui.com/docs) is an open library aimed at AI
applications, built on Tailwind v4, Motion and shadcn/ui.[^kokonut] The category
that earns the link is AI: model selector, tool calls, inline citations, context
meter. The component I bookmarked is
[AI Token Alternatives](https://kokonutui.com/docs/ai/ai-token-alternatives): a
model answer in which every unsure word shows the alternatives the model
weighed, with the probability of each.

### Bklit UI

[Bklit UI](https://bklit.com/) distributes React charts through the same
registry, built with d3, Motion and Tailwind v4. It goes from the basics (area,
bar, line, pie) to what usually takes another library: Sankey, sunburst,
candlestick, choropleth map. It is where I look first when a dashboard needs a
chart.

## Motion

Four libraries, one job each. When two do the same job on the same page, the
bundle grows and the animations start fighting over the same element.

### GSAP

[GSAP](https://gsap.com/) is the library I use when an animation needs
precision: timelines, playback control and, with the ScrollTrigger plugin,
movement tied to the scroll. It is now a Webflow product and became entirely
free, including the plugins that used to be paid, such as SplitText and
MorphSVG.[^gsap] Installing it is `npm install gsap`, and it is what
choreographs this site.

The project gallery on the home page sums up what it does. The section stays
pinned to the screen (`pin`) and the vertical scroll pushes the track of panels
sideways (`scrub`):

```ts title="src/components/sections/Work.tsx" {8-9}
gsap.to(track, {
  x: () => -distance(),
  ease: 'none',
  scrollTrigger: {
    trigger: root,
    start: 'top top',
    end: () => `+=${distance() * WORK_TRAVEL_RATIO}`,
    pin: true,
    scrub: 1,
    invalidateOnRefresh: true,
  },
})
```

Two precautions apply to any use. In React, every animation created in an effect
has to be reverted on unmount, and the `@gsap/react` package ships the `useGSAP`
hook for that. And `gsap.matchMedia()` lets the choreography exist only where it
makes sense: here, the horizontal gallery is only set up on a wide screen.

### Lenis

[Lenis](https://lenis.dev/), by darkroom.engineering, smooths scrolling without
replacing it: the page still really scrolls, so `position: sticky` and the
scrollbar keep working.[^lenis] It is light, has no dependencies, and runs on
the home page and the Journal of this site, this page included.

The hard part is the clock. Lenis and ScrollTrigger have to advance on the same
frame. If each runs its own loop, pinned content jitters. This is how this site
ties them together, in a shortened version:

::::steps
```tsx title="src/components/layout/SmoothScroll.tsx" numbers
export function SmoothScroll({ children }: Props) {
  const lenisRef = useRef<LenisRef>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    if (reduced) return
    const lenis = lenisRef.current?.lenis
    const update = (time: number) => lenis?.raf(time * 1000)

    gsap.ticker.add(update)
    gsap.ticker.lagSmoothing(0)
    lenis?.on('scroll', ScrollTrigger.update)
    return () => {
      gsap.ticker.remove(update)
      lenis?.off('scroll', ScrollTrigger.update)
    }
  }, [reduced])

  if (reduced) return <>{children}</>
  return (
    <ReactLenis
      root
      ref={lenisRef}
      options={{ autoRaf: false }}
    >
      {children}
    </ReactLenis>
  )
}
```

:::step{lines=24}
**No clock of its own.** `autoRaf: false` tells Lenis it will not run its own
`requestAnimationFrame`. Someone outside will call `raf` on every frame.
:::

:::step{lines=8,10-11}
**One clock only.** That someone is the GSAP `ticker`. It hands over time in
seconds and Lenis expects milliseconds, hence the `* 1000`. And
`lagSmoothing(0)` turns off GSAP's lag compensation: with it on, after a slow
frame the animation time and the scroll position would stop matching.
:::

:::step{lines=12}
**The scroll reports in.** On every Lenis scroll event, ScrollTrigger
recalculates. That is what keeps pinned sections and scroll-bound animations in
the right place.
:::

:::step{lines=3,6,19}
**Reduced motion.** Anyone who asked the system for less motion does not get
Lenis. The component returns its children with nothing around them and scrolling
is the browser's own.
:::

:::step{lines=13-16}
**Cleanup.** On unmount, the loop and the listener go away. Without that, every
page change would leave a clock running.
:::
::::

### Motion

[Motion](https://motion.dev/docs) is the former Framer Motion.[^motion] It comes
in when movement is born from React state: an item entering and leaving the
tree, a layout rearranging itself, a drag gesture. The animation is declared on
the component itself, and `AnimatePresence` covers the most annoying case, which
is animating the exit of an element React has already removed from the tree. The
menu on this site opens and closes this way.

```tsx title="Notice.tsx" {8}
import { AnimatePresence, motion } from 'motion/react'

<AnimatePresence>
  {open && (
    <motion.p
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
    >
      Saved.
    </motion.p>
  )}
</AnimatePresence>
```

Outside React there is the `animate` function, imported straight from `motion`,
and there is a version for Vue.

### Anime.js

[Anime.js](https://animejs.com/documentation/), by Julian Garnier, is an
animation engine in plain JavaScript. Version 4 is modular: I import `animate`,
`createTimeline` or `stagger` and only that goes into the bundle. The whole
library is around 24 KB. It does a good part of what GSAP does (timelines, SVG
line drawing, text split into letters) under the MIT license, and you pay only
for what you import. It is the one I pick for a page with no framework, from
static HTML to an Astro site.

In React, the documentation recommends creating a scope inside the effect and
reverting it on unmount:

```tsx title="Logo.tsx" {5}
useEffect(() => {
  scope.current = createScope({ root }).add(() => {
    animate('.logo', { rotate: 360, duration: 1200 })
  })
  return () => scope.current.revert()
}, [])
```

### Which one for what

| Job | Tool |
| --- | --- |
| Smooth scrolling | Lenis |
| Scroll-driven animation with a pinned section | GSAP with ScrollTrigger |
| Enter, exit and layout in React | Motion |
| Sequences and SVG on a page with no framework | Anime.js |

## The third dimension: Three.js

[Three.js](https://github.com/mrdoob/three.js/) is for when the idea grows
beyond 2D: a model turning on the page, a scene with light and a camera, an
effect written as a shader. It is a 3D library for the browser, with WebGL and
WebGPU renderers.[^three]

One expectation to adjust: Three.js does not model, it displays. The model is
made in a tool such as Blender, exported as glTF, and Three.js loads that file
with `GLTFLoader`, lights it and renders it.

```bash title="terminal"
npm install three @react-three/fiber
```

In React I use it through React Three Fiber, which describes the scene as
components. The background of this site's cover is exactly that: a plane the
size of the screen with a shader that reacts to the cursor and to scroll
velocity.

```tsx title="src/components/canvas/InkFieldScene.tsx" {2-3}
<Canvas
  frameloop={active ? 'always' : 'never'}
  dpr={[1, isDesktop ? 1.5 : 1]}
  orthographic
>
  <InkPlane />
</Canvas>
```

Three.js is by far the heaviest item on this list, so it comes in with rules:

- **Loads last.** It sits in a separate file, downloaded only after the first interaction. Until then the cover shows a static gradient.
- **Stops off screen.** When the cover leaves the visible area the render loop is switched off: that is `frameloop` turning to `never`.
- **Capped resolution.** Pixel density goes up to 1.5 on desktop and stays at 1 on phones. Rendering at a phone screen's full density multiplies the pixels with no visible gain.
- **Reduced motion.** Anyone who asked for less motion keeps the static gradient and never downloads the library.

## Skills: judgment for the agent

A good part of my interfaces today is written with a coding agent beside me, and
an agent with no direction always delivers the same generic screen. A skill is a
pack of instructions the agent loads when the task calls for it. These four are
about design and install into agents such as Claude Code, Cursor and Codex.

### Impeccable

[Impeccable](https://impeccable.style/docs/impeccable/), by Paul Bakaus, gives
the agent a design vocabulary and a set of commands around `/impeccable`.
`shape` plans before the code, `critique` runs a scored UX review, `audit`
raises technical problems, and `polish` and `harden` finish the job. `init`
writes a `PRODUCT.md` with audience and purpose, and `document` records the
visual system in a `DESIGN.md` that the following commands read.[^designmd]

The part I use most is the detector: dozens of deterministic rules, with no
model and no API key, that point out the typical tells of an AI-generated
interface.

```bash title="terminal"
npx impeccable install
npx impeccable detect src/
```

### Taste Skill

[Taste Skill](https://www.tasteskill.dev/), by Leon Lin and blueemi, handles art
direction when the agent is building a site from scratch. It picks one of twenty
directions, with a palette, gathers reference images and checks the result in a
browser before handing it over.[^taste]

```bash title="terminal"
npx skills add Leonxlnx/taste-skill
```

### emilkowalski/skills

The skills by Emil Kowalski, author of Sonner, number nineteen, and nearly all
of them deal with interface animation. `animate` builds an animation by choosing
curve, duration and properties. `review-animations` reviews the ones that
already exist. `remove-animations` takes out motion that does not need to exist,
and `animation-performance` goes after dropped frames. Outside animation,
`break-ui` tests the screen with the worst possible data.

::repo{owner=emilkowalski name=skills desc="Skills for designers and engineers: animation, gestures and interface review."}

```bash title="terminal"
npx skills@latest add emilkowalski/skills
```

One example of the kind of rule they teach: an enter animation uses `ease-out`,
not `ease-in`.

### UI Skills

[UI Skills](https://www.ui-skills.com/), by Julien Thibeaut (ibelick), is an
open registry of skills built for design engineers.[^uiskills] Instead of loose
tips, each module acts as a concrete set of constraints for building and
reviewing interfaces: `baseline-ui` sets rules for layout, typography and
consistency, `fixing-accessibility` audits focus, ARIA and contrast,
`fixing-metadata` checks HTML metadata and Open Graph tags, and
`fixing-motion-performance` cuts heavy animations or layout thrashing.

::repo{owner=ibelick name=ui-skills desc="Skills for design engineers: baseline UI, accessibility, metadata and motion performance."}

```bash title="terminal"
npx skills@latest add ibelick/ui-skills
```

## Research: the client's brand

On a client project the art direction is not mine to invent. The interface has
to ship with the palette, the typography and the logo of whoever hired me, so
before opening any collection I gather that with two tools that work together.

### research

[research](https://github.com/mattpocock/skills/tree/main/skills/engineering/research)
is a skill by Matt Pocock. It sends a background agent, with a clean context, to
investigate a question against primary sources and save the result as a single
Markdown file inside the repository, with the source of every claim. For a
brand, the primary source is the client: the site, the brand guidelines, the
official profiles.

```bash title="terminal"
npx skills@latest add mattpocock/skills
```

### Firecrawl

[Firecrawl](https://www.firecrawl.dev/) is what gives that agent eyes. It is a
web data API made for agents: it reads a page and returns clean Markdown, a
screenshot or structured data.[^firecrawl] The format I care about here is
`branding`, which extracts the page's identity: color scheme, palette, fonts,
type scale, spacing, logo and favicon.

```json title="POST /v2/scrape" {3}
{
  "url": "https://www.client.example",
  "formats": ["branding", "screenshot", "images"]
}
```

In the agent, installing it takes one line. With it, the agent that research
dispatches is able to read the client's site, take the screenshot and list the
images.

```bash title="terminal"
npx -y firecrawl-cli@latest init --all --browser
```

What comes out is a research file in the repository, with the colors in
hexadecimal, the fonts, the logo and the page each thing came from. The
project's tokens and the `DESIGN.md` come out of it.

:::callout{type=tip title="Extraction is a starting point"}
I confirm brand colors against the brand guidelines, when they exist. The logo I
ask the client for as a vector file: the image taken from the site is a
reference, not a final asset.
:::

## How the pieces fit

1. **Direction before components.** On a client project I start with the brand research. `PRODUCT.md` and `DESIGN.md` record who the interface is for and what it looks like. Without that, any good-looking component becomes a collage.
2. **I look for the pattern, not the part.** I open the collections with a question and compare two or three answers.
3. **Install or rewrite.** If the component fits and the project already has its dependencies, I install it from the registry. If it would bring in a new library to do one thing, I rewrite the pattern with what is already in the project.
4. **Dress it in the tokens.** The component's colors, fonts and spacing go out, the project's come in.
5. **Review.** Impeccable's detector, keyboard navigation, reduced motion and the size of the build.

This site is the example I have at hand. No component from those collections was
installed in it: the patterns were rewritten with GSAP, Lenis and the project's
tokens, and no new dependency entered the bundle because of it. The marquee on
the home page started from React Bits' Scroll Velocity and Componentry's
Velocity Scroll. The pinned panel of the walkthrough, a few sections up, started
from Componentry's Sticky Scroll Cards and Skiper's Card stack scroll.

## What I check before copying

:::callout{type=warn title="License first"}
Free does not mean unconditional. This list has a Commons Clause, an attribution
requirement and paid plans living alongside the open part. Read the license of
the specific component before taking it into a client project.
:::

- **Reduced motion.** Every effect needs a path for `prefers-reduced-motion`. Much of what gets copied has none.
- **Nothing on hover alone.** Information that only appears under the cursor does not exist on touch or on the keyboard.
- **Loops off screen.** Canvas, WebGL and marquees stop when they leave the visible area.
- **Weight.** A component can bring a whole animation library with it. Compare the bundle before and after.

The list is good for November 2026. When the bench changes, this entry changes
with it.

[^mcp]: shadcn also has an MCP server, switched on with `npx shadcn@latest mcp init --client claude`. With it the agent searches and installs items from any configured registry.
[^reactbits]: The license is MIT with a Commons Clause. Personal and commercial use is allowed; reselling or redistributing the components themselves is not.
[^skiper]: The free version asks for attribution to Skiper UI, and the site's terms forbid republishing the code.
[^componentry]: The pattern there is called Annotated Text. Here it was rewritten on top of Markdown footnotes, with nothing installed.
[^kokonut]: The components are MIT. Kokonut UI Pro, which is paid, adds more components and page templates.
[^gsap]: The license is not MIT. It is GSAP's standard no-charge license: it allows commercial use and forbids using the library in no-code animation tools that compete with Webflow's.
[^three]: This site stays on r182 on purpose. React Three Fiber 9 depends on `THREE.Clock`, which r183 marked as deprecated, so the version only goes up after checking R3F.
[^lenis]: The limits are in the README. It does not combine with CSS scroll-snap (there is a `lenis/snap` package for that), and a container with its own scrolling has to be marked with `data-lenis-prevent`.
[^motion]: The package is now called `motion` and the React import is `motion/react`. Older projects, this site among them, still import from `framer-motion`. The library is open; Motion+ is paid.
[^designmd]: This site has a `DESIGN.md` like that. It is what keeps color, typography and motion consistent between the home page and the Journal.
[^firecrawl]: The code is open, under AGPL-3.0, and can be self-hosted. The service has a free plan with monthly credits and no card required.
[^taste]: It needs Node 22 or newer and a Chromium browser installed, because of the in-browser check.
[^uiskills]: Beyond installing via `skills`, the registry can be queried from the terminal with `npx ui-skills` or connected straight to an agent through its MCP server at `https://www.ui-skills.com/mcp`.
