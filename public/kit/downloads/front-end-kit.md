# Front-end kit — Marcus Boni

Seventeen tools I open before designing an interface, on six shelves. All of them can be used for free; the license sits next to each one.

- Kit page: https://marcusboni.com.br/en/kit/front-end
- Full entry: https://marcusboni.com.br/en/blog/caixa-de-ferramentas-front-end
- Licenses checked on: 2026-11-25

## The base

- [shadcn/ui](https://ui.shadcn.com/): Base components copied into your project, and the registry the collections below install through. License: MIT.

## Component collections

- [React Bits](https://www.reactbits.dev/get-started/introduction): Over two hundred animated text, background and interface components, in JS or TS, CSS or Tailwind. License: MIT + Commons Clause.
- [Skiper UI](https://skiper-ui.com/components): Scroll and cursor interactions: progress bars, text that reveals itself, stacks of cards. License: Free with attribution.
- [Componentry](https://componentry.dev/docs): Editable source focused on scroll, kinetic typography and WebGL effects. License: MIT.
- [KokonutUI](https://kokonutui.com/docs/ai/ai-token-alternatives): Components for AI products: model selector, tool calls, citations, token alternatives. License: MIT.
- [Bklit UI](https://bklit.com/): React charts on d3 and Motion, from area and bar charts to Sankey and choropleth maps. License: MIT.

## Motion

- [GSAP](https://gsap.com/): Timelines and scroll-bound animation with ScrollTrigger. Entirely free, plugins included. License: Free, own license.
- [Lenis](https://lenis.dev/): Smooth scrolling that keeps the browser's own: sticky positioning and the scrollbar still work. License: MIT.
- [Motion](https://motion.dev/docs): The former Framer Motion: enter, exit, layout and gestures driven by React state. License: MIT.
- [Anime.js](https://animejs.com/documentation/): A modular animation engine in plain JavaScript, for pages with no framework. License: MIT.

## The third dimension

- [Three.js](https://github.com/mrdoob/three.js/): 3D in the browser with WebGL and WebGPU: glTF models, scenes, lighting and shaders. License: MIT.

## Skills for the agent

- [Impeccable](https://impeccable.style/docs/impeccable/): A design vocabulary for the agent, with review, polish and a detector for generic interfaces. License: Apache 2.0.
- [Taste Skill](https://www.tasteskill.dev/): Art direction for an agent building a site from scratch, with references and an in-browser check. License: MIT.
- [emilkowalski/skills](https://github.com/emilkowalski/skills): Nineteen interface animation skills: build, review, remove and optimise motion. License: MIT.
- [UI Skills](https://www.ui-skills.com/): Skills for design engineers: baseline UI, accessibility, metadata and motion performance, with CLI and MCP. License: MIT.

## Brand research

- [research](https://github.com/mattpocock/skills/tree/main/skills/engineering/research): Matt Pocock's skill that investigates primary sources and saves a cited result in the repository. License: MIT.
- [Firecrawl](https://www.firecrawl.dev/): Reads sites for the agent and extracts the visual identity: palette, fonts, logo and screenshot. License: AGPL-3.0.

## Install the skills

One paste in a terminal installs the six skills on the list into your coding agent. Each line asks which agent to install into.

```bash
npx skills@latest add pbakaus/impeccable
npx skills@latest add Leonxlnx/taste-skill
npx skills@latest add emilkowalski/skills
npx skills@latest add ibelick/ui-skills
npx skills@latest add mattpocock/skills --skill research
npx skills@latest add firecrawl/skills
```
