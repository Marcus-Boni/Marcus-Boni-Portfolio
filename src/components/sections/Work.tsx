import { useLayoutEffect, useRef, type PointerEvent } from 'react'

import { useSiteContent } from '@/content/SiteContentContext'
import type { Project } from '@/data/profile'
import { gsap } from '@/animations/gsap'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useGsapScope } from '@/hooks/useScrollReveal'
import { useScramble } from '@/hooks/useScramble'
import { useLanguage } from '@/i18n/LanguageContext'
import { trackEvent } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import { HoverItalic } from '@/components/ui/HoverItalic'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { WORK_TRAVEL_RATIO, workTrackDistance } from '@/lib/work-layout'

function ProjectPanel({ project, gallery }: { project: Project; gallery: boolean }) {
  const { locale, t } = useLanguage()
  const numberRef = useRef<HTMLSpanElement>(null)
  const { ref: ctaRef, scramble: scrambleCta } = useScramble<HTMLSpanElement>(
    t.work.viewOnGithub,
  )
  const moveTo = useRef<{ x: (v: number) => void; y: (v: number) => void } | null>(
    null,
  )

  useLayoutEffect(() => {
    const el = numberRef.current
    if (!el || !window.matchMedia('(pointer: fine)').matches) return
    moveTo.current = {
      x: gsap.quickTo(el, 'x', { duration: 0.9, ease: 'power3.out' }),
      y: gsap.quickTo(el, 'y', { duration: 0.9, ease: 'power3.out' }),
    }
    return () => {
      moveTo.current = null
      gsap.set(el, { x: 0, y: 0 })
    }
  }, [])

  const onEnter = () => scrambleCta()
  const onMove = (event: PointerEvent<HTMLAnchorElement>) => {
    if (!moveTo.current) return
    const rect = event.currentTarget.getBoundingClientRect()
    const relX = (event.clientX - rect.left) / rect.width - 0.5
    const relY = (event.clientY - rect.top) / rect.height - 0.5
    moveTo.current.x(relX * 44)
    moveTo.current.y(relY * 32)
  }
  const onLeave = () => {
    moveTo.current?.x(0)
    moveTo.current?.y(0)
  }

  return (
    <a
      href={project.url}
      target="_blank"
      rel="noreferrer"
      data-cursor="view"
      aria-label={`${project.title} — ${t.work.viewOnGithub}`}
      onPointerEnter={onEnter}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onClick={() => trackEvent('outbound_click', { label: project.title })}
      className={cn(
        'group relative flex w-[86vw] shrink-0 flex-col justify-between border-l border-line px-6 py-10 md:w-[44rem] md:px-12 lg:py-10 lg-short:py-8 xl:py-14',
        gallery && 'lg:[container-type:size]',
      )}
    >
      <span
        ref={numberRef}
        aria-hidden
        className={cn(
          'text-outline pointer-events-none absolute -top-2 right-4 font-sans text-[clamp(5rem,10vw,9rem)] font-bold transition-colors duration-500 will-change-transform group-hover:text-outline-ember',
          // In the gallery a panel is as tall as the screen allows, and the
          // numeral takes the band the title and the description leave between
          // them. The panel is a size container, so the numeral is sized from
          // the panel's own height: what is left of its content box once the
          // title and the copy (about 16.5rem between them) are taken out.
          gallery &&
            'lg:top-[48%] lg:right-10 lg:-translate-y-1/2 lg:text-[clamp(4rem,calc(100cqh-16.5rem),11rem)] lg:leading-none',
        )}
      >
        {project.index}
      </span>

      <header>
        {/* Wherever the numeral sits in the top corner, the line stops short of it. */}
        <p
          className={cn(
            'font-mono text-[10px] leading-relaxed tracking-[0.25em] text-smoke uppercase',
            gallery ? 'max-lg:pr-28' : 'pr-28',
          )}
        >
          {project.year} — {project.stack.join(' / ')}
        </p>
        <h3 className="mt-6 text-[clamp(2.4rem,5vw,4.5rem)] leading-[0.95] text-bone">
          <HoverItalic text={project.title} />
        </h3>
      </header>

      <div className="mt-10 md:mt-0">
        <p className="max-w-md text-sm leading-relaxed text-bone-dim md:text-base">
          {project.description[locale]}
        </p>
        <span className="mt-8 inline-flex items-center gap-3 font-mono text-[11px] tracking-[0.22em] text-bone uppercase transition-colors group-hover:text-ember">
          <span className="h-px w-10 bg-current transition-all duration-300 group-hover:w-16" />
          <span ref={ctaRef}>{t.work.viewOnGithub}</span>
        </span>
      </div>
    </a>
  )
}

/**
 * Selected work. Desktop: a pinned section where scroll drives a horizontal
 * track of case panels. Touch/mobile: a plain vertical stack.
 */
export function Work() {
  const { t } = useLanguage()
  const reduced = usePrefersReducedMotion()
  const { content } = useSiteContent()
  const { projects, profile } = content

  const scopeRef = useGsapScope<HTMLElement>(({ root }) => {
    const track = root.querySelector<HTMLElement>('[data-track]')
    if (!track) return

    const count = root.querySelector<HTMLElement>('[data-work-count]')
    const bar = root.querySelector<HTMLElement>('[data-work-progress]')
    let shown = 0

    const mm = gsap.matchMedia()
    mm.add('(min-width: 1024px)', () => {
      const distance = () =>
        workTrackDistance({
          trackWidth: track.scrollWidth,
          visibleWidth: track.clientWidth,
        })
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
          // Position readout, written straight to the DOM: the panel count is
          // read live so content arriving from the CMS never leaves it stale.
          onUpdate: (self) => {
            if (bar) bar.style.transform = `scaleX(${self.progress})`
            const total = track.children.length
            const current = Math.min(total, Math.floor(self.progress * total) + 1)
            if (count && current !== shown) {
              shown = current
              count.textContent = String(current).padStart(2, '0')
            }
          },
        },
      })
    })
    return () => mm.revert()
  })

  return (
    <section id="work" ref={scopeRef} aria-label={t.work.label}>
      <div
        className={cn(
          'px-5 pt-28 md:px-8 md:pt-32 lg:pl-24 lg:pt-24 lg-short:pt-16 xl:pt-32',
          // A column, so the track below can take whatever height the heading
          // leaves: the panels then run to the bottom edge of the screen.
          !reduced && 'lg:flex lg:h-svh lg:flex-col lg:overflow-hidden',
        )}
      >
        <SectionHeading number="03" label={t.work.label} />

        <div className="mt-10 flex items-end justify-between lg:mt-12">
          <h2 className="wdth-condensed font-sans text-mega leading-[0.9] font-bold uppercase">
            {t.work.title}
          </h2>
          {!reduced && (
            <div className="hidden pb-4 font-mono text-[10px] tracking-[0.25em] text-smoke uppercase lg:flex lg:flex-col lg:items-end lg:gap-3">
              <p data-cursor="drag">{t.work.hint}</p>
              <p aria-hidden className="flex items-center gap-4">
                <span className="tabular-nums">
                  <span data-work-count className="text-bone">01</span>
                  {' / '}
                  {String(projects.length + 1).padStart(2, '0')}
                </span>
                <span className="block h-px w-28 bg-line">
                  <span
                    data-work-progress
                    className="block h-px w-full origin-left scale-x-0 bg-ember"
                  />
                </span>
              </p>
            </div>
          )}
        </div>

        <div
          data-track
          className={cn(
            'mt-12 flex flex-col gap-16 will-change-transform lg:mt-10 lg-short:mt-6 xl:mt-16',
            !reduced && 'lg:min-h-0 lg:flex-1 lg:flex-row lg:gap-0',
          )}
        >
          {projects.map((project) => (
            <ProjectPanel key={project.title} project={project} gallery={!reduced} />
          ))}

          <a
            href={profile.github}
            target="_blank"
            rel="noreferrer"
            data-cursor="view"
            onClick={() => trackEvent('outbound_click', { label: 'GitHub archive' })}
            className="group flex w-[86vw] shrink-0 flex-col items-start justify-center gap-6 border-l border-line px-6 py-10 md:w-[36rem] md:px-12 lg:py-10 lg-short:py-8 xl:py-14"
          >
            <span className="font-mono text-[10px] tracking-[0.25em] text-smoke uppercase">
              {t.work.others(profile.repoCount - projects.length)}
            </span>
            <span className="text-[clamp(2.2rem,4.5vw,4rem)] leading-[1] text-bone">
              <HoverItalic text={t.work.archive} />
            </span>
          </a>
        </div>
      </div>
    </section>
  )
}
