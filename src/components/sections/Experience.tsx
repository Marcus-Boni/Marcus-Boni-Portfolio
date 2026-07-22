import { useSiteContent } from '@/content/SiteContentContext'
import type { ExperienceProject } from '@/data/profile'
import { gsap, ScrollTrigger } from '@/animations/gsap'
import { useMagnetic } from '@/hooks/useMagnetic'
import { useScramble } from '@/hooks/useScramble'
import { useGsapScope } from '@/hooks/useScrollReveal'
import { useLanguage } from '@/i18n/LanguageContext'
import { trackEvent } from '@/lib/analytics'
import { Button } from '@/components/ui/button'
import { HoverItalic } from '@/components/ui/HoverItalic'
import { SectionHeading } from '@/components/ui/SectionHeading'

const pad2 = (value: number) => String(value).padStart(2, '0')

function StackChips({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2" role="list">
      {items.map((item) => (
        <li
          key={item}
          className="border border-line px-2.5 py-1 font-mono text-[10px] tracking-[0.15em] text-bone-dim uppercase"
        >
          {item}
        </li>
      ))}
    </ul>
  )
}

function LedgerEntry({
  project,
  index,
  total,
}: {
  project: ExperienceProject
  index: number
  total: number
}) {
  const { locale, t } = useLanguage()

  return (
    <article
      data-entry
      className="group relative border-t border-line py-12 pl-8 md:py-14 md:pl-14"
    >
      {/* node marker riding the spine */}
      <span
        aria-hidden
        className="absolute top-[3.15rem] left-0 size-[9px] -translate-x-1/2 rounded-full border border-ember bg-ink transition-colors duration-500 group-hover:bg-ember group-[.is-active]:bg-ember md:top-[3.65rem]"
      />

      <div data-entry-inner>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <span className="font-mono text-[10px] tracking-[0.25em] text-ember uppercase">
            {project.sector[locale]}
          </span>
          <span className="font-mono text-[10px] tracking-[0.2em] text-smoke">
            {pad2(index + 1)} — {pad2(total)}
          </span>
        </div>

        <h3 className="mt-5 text-[clamp(2rem,3.4vw,3.4rem)] leading-[1.02] text-bone">
          <HoverItalic text={project.client} />
        </h3>
        <p className="mt-2 font-display-italic text-lg text-bone-dim">
          {project.title[locale]}
        </p>

        <div className="mt-6 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,15rem)] md:gap-10 lg:gap-14">
          <p className="max-w-xl text-sm leading-relaxed text-bone-dim">
            {project.scope[locale]}
          </p>
          <div className="mt-6 md:mt-0">
            <span className="mb-3 block font-mono text-[10px] tracking-[0.25em] text-smoke uppercase">
              {t.experience.stackLabel}
            </span>
            <StackChips items={project.stack} />
          </div>
        </div>
      </div>
    </article>
  )
}

/** Open-ended closing entry — signals the trajectory keeps going. */
function OngoingEntry() {
  const { t } = useLanguage()

  return (
    <article
      data-entry
      className="group relative border-t border-line py-12 pl-8 md:py-14 md:pl-14"
    >
      {/* pulsing marker */}
      <span
        aria-hidden
        className="absolute top-[3.15rem] left-0 -translate-x-1/2 md:top-[3.65rem]"
      >
        <span className="block size-[9px] rounded-full bg-ember" />
        <span className="absolute inset-0 animate-ping rounded-full bg-ember/60" />
      </span>

      <div data-entry-inner>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <span className="font-mono text-[10px] tracking-[0.25em] text-ember uppercase">
            {t.experience.moreSector}
          </span>
          <span className="font-mono text-sm leading-none text-smoke">∞</span>
        </div>

        <h3 className="mt-5 font-display-italic text-[clamp(2rem,3.4vw,3.4rem)] leading-[1.02] text-ember">
          {t.experience.moreTitle}
        </h3>
        <p className="mt-2 font-mono text-[10px] tracking-[0.2em] text-smoke uppercase">
          {t.experience.moreSubtitle}
        </p>

        <p className="mt-6 max-w-xl text-sm leading-relaxed text-bone-dim">
          {t.experience.moreText}
        </p>
      </div>
    </article>
  )
}

/** "Jun 2024 — Presente/Present" from ISO-ish `YYYY-MM` bounds. */
function formatPeriod(start: string, end: string | null, locale: 'pt' | 'en'): string {
  const fmt = (value: string) => {
    const [year, month] = value.split('-')
    if (!year) return value
    if (!month) return year
    const date = new Date(Number(year), Number(month) - 1, 1)
    const label = new Intl.DateTimeFormat(locale === 'pt' ? 'pt-BR' : 'en', {
      month: 'short',
      year: 'numeric',
    }).format(date)
    return label.charAt(0).toUpperCase() + label.slice(1)
  }
  const present = locale === 'pt' ? 'Presente' : 'Present'
  return `${fmt(start)} — ${end ? fmt(end) : present}`
}

/**
 * Professional history as a vertical "ledger". A sticky index rail (rolling
 * chapter counter, active sector, scroll progress, role + CV CTA) tracks the
 * reading position while the entries scroll naturally on the right past a
 * spine that draws itself in ember. The entry under the viewport centre is
 * spotlit; the rest dim — no pinning, so it reads nothing like the horizontal
 * Work gallery. Mobile keeps the spine as a plain vertical timeline.
 */
export function Experience() {
  const { t, locale } = useLanguage()
  const { content } = useSiteContent()
  const { experience } = content
  const magneticRef = useMagnetic<HTMLDivElement>(0.3)
  const { ref: cvRef, scramble: scrambleCv } = useScramble<HTMLSpanElement>(
    t.experience.downloadCv,
  )

  const total = experience.projects.length
  const counterItems = [...experience.projects.map((_, i) => pad2(i + 1)), '∞']
  const sectorItems = [
    ...experience.projects.map((p) => p.sector[locale]),
    t.experience.moreSector,
  ]

  const scopeRef = useGsapScope<HTMLElement>(
    ({ root }) => {
      const entries = Array.from(root.querySelectorAll<HTMLElement>('[data-entry]'))
      const list = root.querySelector<HTMLElement>('[data-entries]')
      if (entries.length === 0 || !list) return

      // spotlight dimming only kicks in once GSAP is driving the section, so
      // no-JS / reduced-motion readers keep every entry at full contrast
      root.classList.add('exp-focus')

      const rollers = Array.from(root.querySelectorAll<HTMLElement>('[data-roller]'))
      const steps = entries.length
      let active = -1
      const setActive = (index: number) => {
        if (index === active) return
        active = index
        entries.forEach((el, i) => el.classList.toggle('is-active', i === index))
        for (const roller of rollers) {
          // each item is 1/steps of the column, so shift in column-percent
          gsap.to(roller, {
            yPercent: (-100 / steps) * index,
            duration: 0.8,
            overwrite: 'auto',
          })
        }
      }
      setActive(0)

      entries.forEach((el, index) => {
        ScrollTrigger.create({
          trigger: el,
          start: 'top 55%',
          end: 'bottom 55%',
          onToggle: (self) => {
            if (self.isActive) setActive(index)
          },
        })

        const inner = el.querySelector('[data-entry-inner]')
        if (inner) {
          gsap.from(inner, {
            y: 44,
            opacity: 0,
            duration: 1.1,
            scrollTrigger: { trigger: el, start: 'top 82%', once: true },
          })
        }
      })

      // ember spine + rail progress draw together as the ledger is read
      const draws: Array<[HTMLElement | null, 'scaleX' | 'scaleY']> = [
        [root.querySelector<HTMLElement>('[data-spine-draw]'), 'scaleY'],
        [root.querySelector<HTMLElement>('[data-progress]'), 'scaleX'],
      ]
      for (const [el, axis] of draws) {
        if (!el) continue
        gsap.fromTo(
          el,
          { [axis]: 0 },
          {
            [axis]: 1,
            ease: 'none',
            transformOrigin: 'left top',
            scrollTrigger: {
              trigger: list,
              start: 'top 62%',
              end: 'bottom 55%',
              scrub: 0.6,
              invalidateOnRefresh: true,
            },
          },
        )
      }
    },
    [experience.projects.length],
  )

  return (
    <section id="experience" ref={scopeRef} aria-label={t.experience.label}>
      <div className="px-5 pt-28 pb-24 md:px-8 md:pt-40 lg:pb-36 lg:pl-24">
        <SectionHeading number="04" label={t.experience.label} />

        <h2 className="wdth-condensed mt-10 font-sans text-mega leading-[0.9] font-bold uppercase lg:mt-12">
          {t.experience.title}
        </h2>

        {/* ── ledger grid: sticky index rail + scrolling entries ── */}
        <div className="mt-6 lg:mt-16 lg:grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-x-20 xl:gap-x-28">
          <aside>
            <div className="lg:sticky lg:top-0 lg:flex lg:h-svh lg:flex-col lg:justify-center">
              {/* rolling chapter counter — the rail's hero, desktop only */}
              <div aria-hidden className="hidden lg:block">
                <div className="flex items-end gap-4">
                  <span className="block h-[1em] overflow-hidden font-sans text-[clamp(4.5rem,7vw,7.5rem)] lg-short:text-[3.8rem] leading-none font-bold wdth-condensed">
                    <span data-roller className="block will-change-transform">
                      {counterItems.map((item) => (
                        <span key={item} className="text-outline-ember block h-[1em]">
                          {item}
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className="pb-[0.35rem] font-mono text-xs tracking-[0.2em] text-smoke">
                    / {pad2(total)}
                  </span>
                </div>

                {/* active sector rolls in sync with the counter */}
                <span className="mt-5 block h-[1.5em] overflow-hidden font-mono text-[11px] tracking-[0.28em] text-ember uppercase">
                  <span data-roller className="block will-change-transform">
                    {sectorItems.map((item, i) => (
                      <span
                        key={`${item}-${i}`}
                        className="block h-[1.5em] leading-[1.5] whitespace-nowrap"
                      >
                        {item}
                      </span>
                    ))}
                  </span>
                </span>

                {/* reading progress */}
                <span className="mt-8 lg-short:mt-5 block h-px w-full max-w-[16rem] bg-line">
                  <span
                    data-progress
                    className="block h-px w-full bg-ember will-change-transform"
                  />
                </span>
              </div>

              <div className="mt-8 lg:mt-12 lg-short:mt-8">
                <p className="font-mono text-[11px] tracking-[0.22em] uppercase">
                  <span className="text-bone">{experience.role}</span>
                  <span className="text-smoke"> · </span>
                  <span className="text-ember">{experience.company}</span>
                </p>
                <p className="mt-1 font-mono text-[10px] tracking-[0.2em] text-smoke uppercase">
                  {formatPeriod(experience.start, experience.end, locale)}
                </p>

                <p className="mt-6 lg-short:mt-4 max-w-md text-sm lg-short:text-[13px] leading-relaxed text-bone-dim">
                  {t.experience.lead}
                </p>

                <div
                  ref={magneticRef}
                  className="mt-7 lg-short:mt-5 inline-block"
                  onPointerEnter={() => scrambleCv()}
                >
                  <Button asChild variant="ember" size="pill" data-cursor="link">
                    <a
                      href="/marcus-boni-cv.pdf"
                      download
                      onClick={() => trackEvent('cv_download')}
                    >
                      <span ref={cvRef}>{t.experience.downloadCv}</span>
                      <span aria-hidden>↓</span>
                    </a>
                  </Button>
                </div>

                <p className="mt-8 hidden font-mono text-[10px] tracking-[0.25em] text-smoke uppercase lg:block lg-short:hidden">
                  {t.experience.hint}
                </p>
              </div>
            </div>
          </aside>

          {/* ── entries + self-drawing spine ── */}
          <div data-entries className="relative mt-14 border-b border-line lg:mt-0">
            <span aria-hidden className="absolute top-0 left-0 h-full w-px bg-line" />
            <span
              data-spine-draw
              aria-hidden
              className="absolute top-0 left-0 h-full w-px bg-ember will-change-transform"
            />

            {experience.projects.map((project, index) => (
              <LedgerEntry
                key={project.id}
                project={project}
                index={index}
                total={total}
              />
            ))}
            <OngoingEntry />
          </div>
        </div>
      </div>
    </section>
  )
}
