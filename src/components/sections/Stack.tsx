import type { CSSProperties, ReactNode } from 'react'
import { useLenis } from 'lenis/react'

import { useSiteContent } from '@/content/SiteContentContext'
import type { TechItem } from '@/data/profile'
import { gsap, ScrollTrigger } from '@/animations/gsap'
import { useGsapScope } from '@/hooks/useScrollReveal'
import { useLanguage } from '@/i18n/LanguageContext'
import { cn } from '@/lib/utils'
import { SectionHeading } from '@/components/ui/SectionHeading'

type Category = TechItem['category']

const categories: Category[] = ['frontend', 'backend', 'data', 'ops']

/** Travel speed of the signal along the axis, in px/s. */
const PULSE_SPEED = 230

/**
 * One drawing per layer, authored flat on a 100×100 square and projected onto
 * the plane by a single isometric matrix — so every glyph stays exact
 * geometry: a screen layout, a service graph, a table, a grid of containers.
 */
const glyphs: Record<Category, ReactNode> = {
  frontend: (
    <>
      <rect x="14" y="14" width="72" height="72" />
      <path d="M14 30H86M38 30V86M46 66H78M46 76H66" />
      <rect x="46" y="40" width="32" height="16" />
    </>
  ),
  backend: (
    <>
      <path d="M50 50 23 25M50 50 77 27M50 50 27 76M50 50 75 73" />
      <circle cx="50" cy="50" r="9" className="fill-ink-soft" />
      <circle cx="23" cy="25" r="6" className="fill-ink-soft" />
      <circle cx="77" cy="27" r="6" className="fill-ink-soft" />
      <circle cx="27" cy="76" r="6" className="fill-ink-soft" />
      <circle cx="75" cy="73" r="6" className="fill-ink-soft" />
    </>
  ),
  data: (
    <>
      <rect x="14" y="16" width="72" height="17" fill="currentColor" fillOpacity="0.18" stroke="none" />
      <rect x="14" y="16" width="72" height="68" />
      <path d="M14 33H86M14 50H86M14 67H86M38 16V84M62 16V84" />
    </>
  ),
  ops: (
    <>
      {[14, 40, 66].flatMap((x) =>
        [14, 40, 66].map((y) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="20" height="20"
            fill={x === y ? 'currentColor' : 'none'} fillOpacity="0.18" />
        )),
      )}
    </>
  ),
}

const FACE = 'M120 25 220 75 120 125 20 75Z'

/** A single slab of the stack: top face, two side faces, and its drawing. */
function Plane({ category }: { category: Category }) {
  return (
    <svg viewBox="0 0 240 150" aria-hidden="true" focusable="false"
      className="block h-auto w-full overflow-visible transition-transform duration-700 ease-out-expo group-hover:-translate-y-2">
      <path d="M20 75 120 125V133L20 83Z"
        className="fill-ink stroke-line transition-colors duration-500 group-hover:stroke-ember/50" />
      <path d="M220 75 120 125V133L220 83Z"
        className="fill-[#090807] stroke-line transition-colors duration-500 group-hover:stroke-ember/50" />
      <path d={FACE}
        className="fill-ink-soft stroke-bone-dim/45 transition-colors duration-500 group-hover:fill-[color-mix(in_srgb,var(--color-ember)_14%,var(--color-ink-soft))] group-hover:stroke-ember" />
      <g transform="matrix(1 0.5 -1 0.5 120 25)" fill="none" stroke="currentColor"
        strokeWidth="1" vectorEffect="non-scaling-stroke"
        className="text-smoke transition-colors duration-500 group-hover:text-ember max-sm:opacity-0 [&>*]:[vector-effect:non-scaling-stroke]">
        {glyphs[category]}
      </g>
      {/* lit by the signal as it crosses this layer */}
      <path data-flash d={FACE} opacity="0"
        className="fill-ember/15 stroke-ember" />
      <path data-ripple d={FACE} opacity="0" fill="none" className="stroke-ember" />
      <circle cx="120" cy="75" r="2.5" className="fill-ember" />
    </svg>
  )
}

/**
 * The stack drawn as what the word means: four layers in an exploded
 * isometric view, each called out to the tools that live on it. The layers
 * start as one slab and pull apart with the scroll; a signal then travels the
 * axis from interface to infrastructure, lighting each layer it crosses.
 * Every technology is plain text beside its layer — the figure adds the
 * picture, never hides the list.
 */
export function Stack() {
  const { t } = useLanguage()
  const lenis = useLenis()
  const { content } = useSiteContent()
  const groups = categories.map((category) => ({
    category,
    technologies: content.techStack.filter((tech) => tech.category === category),
  })).filter((group) => group.technologies.length > 0)
  // The lists set one size for the whole figure, chosen by the fullest layer:
  // a long list tightens every layer rather than making one look louder.
  const dense = groups.some((group) => group.technologies.length > 5)

  const scopeRef = useGsapScope<HTMLElement>(({ root }) => {
    const figure = root.querySelector<HTMLElement>('[data-figure]')
    const layers = gsap.utils.toArray<HTMLElement>('[data-layer]', root)
    if (!figure || layers.length === 0) return
    const planes = layers.map((layer) => layer.querySelector<HTMLElement>('[data-plane]'))
    const mid = (layers.length - 1) / 2

    // How far each plane sits from the figure's centre: the collapsed slab.
    const collapsed = (index: number) => {
      const box = figure.getBoundingClientRect()
      const row = layers[index].getBoundingClientRect()
      return box.top + box.height / 2 - (row.top + row.height / 2) + (index - mid) * 9
    }

    gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: figure,
        // keyed to the figure's centre, where the collapsed slab sits, so the
        // separation plays inside the viewport instead of below the fold
        start: 'center 96%',
        end: 'center 46%',
        scrub: 0.7,
        invalidateOnRefresh: true,
      },
    })
      .fromTo(planes, { y: (index: number) => collapsed(index) },
        { y: 0, duration: 1, ease: 'power2.out' }, 0)
      .fromTo(root.querySelectorAll('[data-leader]'), { scaleX: 0 },
        { scaleX: 1, duration: 0.4, stagger: 0.05 }, 0.5)
      .fromTo(root.querySelectorAll('[data-axis]'), { opacity: 0 },
        { opacity: 1, duration: 0.3 }, 0.7)

    gsap.from(root.querySelectorAll('[data-layer-copy]'), {
      opacity: 0,
      x: 20,
      stagger: 0.09,
      duration: 0.9,
      scrollTrigger: { trigger: figure, start: 'top 82%', once: true },
    })

    // The signal: one dot handed from segment to segment down the axis.
    gsap.set(root.querySelectorAll('[data-seg] > span'), { autoAlpha: 1, y: -10 })
    let pulse: gsap.core.Timeline | null = null
    let inView = false
    const buildPulse = () => {
      pulse?.kill()
      const timeline = gsap.timeline({
        repeat: -1,
        repeatDelay: 1.6,
        paused: !inView,
        defaults: { ease: 'none' },
      })
      let at = 0
      for (const layer of layers) {
        const [segIn, segOut] = layer.querySelectorAll<HTMLElement>('[data-seg]')
        const plane = layer.querySelector<HTMLElement>('[data-plane]')
        if (!segIn || !segOut || !plane) continue
        const inLength = segIn.offsetHeight
        const outLength = segOut.offsetHeight
        const through = plane.offsetHeight * 0.4

        timeline.fromTo(segIn.firstElementChild, { y: -10 },
          { y: inLength, duration: (inLength + 10) / PULSE_SPEED }, at)
        at += (inLength + 10) / PULSE_SPEED
        timeline
          .fromTo(layer.querySelector('[data-flash]'), { opacity: 0.95 },
            { opacity: 0, duration: 1, ease: 'power2.out', immediateRender: false }, at)
          .fromTo(layer.querySelector('[data-ripple]'), { scale: 1, opacity: 0.8 },
            { scale: 1.32, opacity: 0, duration: 1.2, ease: 'power2.out',
              transformOrigin: '50% 50%', immediateRender: false }, at)
        at += through / PULSE_SPEED
        timeline.fromTo(segOut.firstElementChild, { y: -10 },
          { y: outLength, duration: (outLength + 10) / PULSE_SPEED }, at)
        at += (outLength + 10) / PULSE_SPEED
      }
      pulse = timeline
    }

    const watcher = ScrollTrigger.create({
      trigger: figure,
      start: 'top bottom',
      end: 'bottom top',
      onRefresh: buildPulse,
      onToggle: (self) => {
        inView = self.isActive
        if (inView) pulse?.play()
        else pulse?.pause()
      },
    })
    inView = watcher.isActive
    buildPulse()

    // Depth: upper layers drift further with the pointer than lower ones.
    const fine = window.matchMedia('(pointer: fine)').matches
    const drift = fine
      ? layers.map((layer, index) => {
          const target = layer.querySelector<HTMLElement>('[data-drift]')
          const depth = 5 + (layers.length - 1 - index) * 3
          return {
            depth,
            x: gsap.quickTo(target, 'x', { duration: 1.1, ease: 'power3.out' }),
            y: gsap.quickTo(target, 'y', { duration: 1.1, ease: 'power3.out' }),
          }
        })
      : []
    const onMove = (event: PointerEvent) => {
      const box = figure.getBoundingClientRect()
      const relX = (event.clientX - box.left) / box.width - 0.5
      const relY = (event.clientY - box.top) / box.height - 0.5
      for (const layer of drift) {
        layer.x(relX * layer.depth * 2)
        layer.y(relY * layer.depth)
      }
    }
    const onLeave = () => {
      for (const layer of drift) {
        layer.x(0)
        layer.y(0)
      }
    }
    if (fine) {
      figure.addEventListener('pointermove', onMove)
      figure.addEventListener('pointerleave', onLeave)
    }

    return () => {
      pulse?.kill()
      figure.removeEventListener('pointermove', onMove)
      figure.removeEventListener('pointerleave', onLeave)
    }
  }, [groups.length])

  return (
    <section
      id="craft"
      ref={scopeRef}
      className="px-5 py-24 md:px-8 md:py-32 lg:pl-24"
      aria-label={t.craft.label}
    >
      <SectionHeading number="05" label={t.craft.label} />

      <div className="mt-12 grid items-start gap-12 lg:grid-cols-12 lg:gap-10">
        <div className="lg:sticky lg:top-28 lg:col-span-4">
          <h2 className="max-w-lg font-display text-[clamp(2rem,3.4vw,3.75rem)] leading-[1.12] text-balance">
            {t.craft.statement}
          </h2>
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-bone-dim md:text-base">
            {t.craft.intro}
          </p>
          <a href="#work"
            onClick={(event) => {
              const target = document.getElementById('work')
              if (!target || !lenis) return
              // A pinned section's position changes during its horizontal
              // journey; its spacer retains the actual start of the section.
              event.preventDefault()
              event.stopPropagation()
              lenis.scrollTo(target.closest<HTMLElement>('.pin-spacer') ?? target,
                { duration: 1.6 })
            }}
            className="group/link mt-8 inline-flex min-h-11 w-fit items-center gap-3 font-mono text-[11px] tracking-[0.18em] text-bone uppercase transition-colors hover:text-ember focus-visible:text-ember">
            <span className="h-px w-8 bg-current transition-[width] duration-500 ease-out-expo group-hover/link:w-14" />
            {t.craft.seeProjects}
          </a>
        </div>

        <div className="lg:col-span-8">
          <div data-figure
            className="relative [--plane-w:5.25rem] sm:[--plane-w:9.5rem] lg:[--plane-w:11.5rem] xl:[--plane-w:15rem] 2xl:[--plane-w:17rem]">
            {groups.map(({ category, technologies }, index) => (
              <section key={category} data-layer
                aria-labelledby={`craft-${category}`}
                style={{ zIndex: groups.length - index } as CSSProperties}
                className="group relative grid min-h-[calc(var(--plane-w)*0.56)] grid-cols-[var(--plane-w)_minmax(0,1fr)] items-center">
                <div className="relative self-stretch">
                  {index === 0 && (
                    <span data-axis aria-hidden="true"
                      className="absolute top-0 left-1/2 h-px w-3 -translate-x-1/2 bg-smoke" />
                  )}
                  {index === groups.length - 1 && (
                    <span data-axis aria-hidden="true"
                      className="absolute bottom-0 left-1/2 size-[7px] -translate-x-1/2 translate-y-1/2 rounded-full border border-smoke bg-ink" />
                  )}
                  {/* axis into the layer: from the row's edge to the plane's centre */}
                  <span data-axis data-seg aria-hidden="true"
                    className="absolute top-0 left-1/2 z-10 h-1/2 w-px overflow-hidden bg-line">
                    <span className="invisible absolute -left-[2.5px] top-0 block h-2.5 w-1.5 rounded-full bg-ember" />
                  </span>
                  {/* axis out of the layer: from under the slab to the row's edge */}
                  <span data-axis data-seg aria-hidden="true"
                    className="absolute bottom-0 left-1/2 top-[calc(50%+var(--plane-w)*0.243)] w-px overflow-hidden bg-line">
                    <span className="invisible absolute -left-[2.5px] top-0 block h-2.5 w-1.5 rounded-full bg-ember" />
                  </span>
                  <div data-plane className="absolute inset-x-0 top-1/2 -translate-y-1/2">
                    <div data-drift>
                      <Plane category={category} />
                    </div>
                  </div>
                </div>

                <div className="relative py-3.5 pl-5 sm:pl-12 lg:pl-14">
                  {/* callout: from the plane's right corner to the bracket */}
                  <span data-leader aria-hidden="true"
                    className="absolute top-1/2 left-[calc(var(--plane-w)*-0.083)] h-px w-[calc(var(--plane-w)*0.083+1rem)] origin-left bg-line transition-colors duration-500 group-hover:bg-ember sm:w-[calc(var(--plane-w)*0.083+2rem)]" />
                  <div data-layer-copy
                    className="border-l border-line pl-4 transition-colors duration-500 group-hover:border-ember sm:pl-6">
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <span aria-hidden="true"
                        className="font-mono text-[10px] tracking-[0.2em] text-ember">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <h3 id={`craft-${category}`}
                        className="text-lg font-semibold text-bone md:text-xl">
                        {t.craft.categories[category]}
                      </h3>
                      <p className="basis-full text-sm leading-snug text-bone-dim">
                        {t.craft.descriptions[category]}
                      </p>
                    </div>
                    <ul role="list"
                      className={cn(
                        "mt-2.5 flex flex-wrap gap-y-0.5 leading-snug font-medium text-bone [&>li:not(:last-child)]:after:font-normal [&>li:not(:last-child)]:after:text-smoke [&>li:not(:last-child)]:after:content-['/']",
                        dense
                          ? 'gap-x-2.5 text-[0.9375rem] sm:gap-x-3.5 md:text-base [&>li:not(:last-child)]:after:ml-2.5 sm:[&>li:not(:last-child)]:after:ml-3.5'
                          : 'gap-x-3 text-[1.0625rem] sm:gap-x-5 md:text-lg [&>li:not(:last-child)]:after:ml-3 sm:[&>li:not(:last-child)]:after:ml-5',
                      )}>
                      {technologies.map((tech) => (
                        <li key={tech.id ?? tech.name}>{tech.name}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            ))}
            <p className="mt-6 font-mono text-[10px] tracking-[0.25em] text-ember uppercase">
              {t.craft.figcaption}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
