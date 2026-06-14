import { experience, type ExperienceProject } from '@/data/profile'
import { gsap } from '@/animations/gsap'
import { useMagnetic } from '@/hooks/useMagnetic'
import { useScramble } from '@/hooks/useScramble'
import { useGsapScope } from '@/hooks/useScrollReveal'
import { useLanguage } from '@/i18n/LanguageContext'
import { Button } from '@/components/ui/button'
import { SectionHeading } from '@/components/ui/SectionHeading'

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

function TimelineNode({
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
      data-node
      className="group relative flex shrink-0 flex-col border-l border-line pb-12 pl-8 lg:w-[24rem] lg:border-l-0 lg:pt-12 lg-short:pt-8 lg:pb-0 lg:pl-0"
    >
      {/* node marker — rides the left spine on mobile, the top spine on desktop */}
      <span
        aria-hidden
        className="absolute top-1.5 left-0 size-3 -translate-x-1/2 rounded-full border border-ember bg-ink transition-colors duration-300 group-hover:bg-ember lg:top-0 lg:translate-x-0 lg:-translate-y-1/2"
      />

      <div className="flex items-baseline justify-between gap-4 lg:pr-10">
        <span className="font-mono text-[10px] tracking-[0.25em] text-ember uppercase">
          {project.sector[locale]}
        </span>
        <span className="font-mono text-[10px] tracking-[0.2em] text-smoke">
          {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </span>
      </div>

      <h3 className="mt-4 lg-short:mt-3 font-display text-[1.9rem] leading-[1] text-bone transition-colors duration-500 group-hover:text-ember md:text-[2.4rem] lg-short:text-[1.8rem]">
        {project.client}
      </h3>
      <p className="mt-1 font-display-italic text-lg lg-short:text-[15px] text-bone-dim">
        {project.title[locale]}
      </p>

      <p className="mt-4 lg-short:mt-3 max-w-sm text-sm lg-short:text-[13px] leading-relaxed text-bone-dim lg:pr-10">
        {project.scope[locale]}
      </p>

      <div className="mt-5 lg-short:mt-3.5 lg:pr-10">
        <span className="mb-3 lg-short:mb-1.5 block font-mono text-[10px] tracking-[0.25em] text-smoke uppercase">
          {t.experience.stackLabel}
        </span>
        <StackChips items={project.stack} />
      </div>
    </article>
  )
}

/** Open-ended closing node — signals the trajectory keeps going. */
function OngoingNode() {
  const { t } = useLanguage()

  return (
    <article
      data-node
      className="group relative flex shrink-0 flex-col border-l border-dashed border-ember/40 pb-12 pl-8 lg:w-[22rem] lg:border-l-0 lg:pt-12 lg-short:pt-8 lg:pb-0 lg:pl-0"
    >
      {/* pulsing marker */}
      <span
        aria-hidden
        className="absolute top-1.5 left-0 -translate-x-1/2 lg:top-0 lg:translate-x-0 lg:-translate-y-1/2"
      >
        <span className="block size-3 rounded-full bg-ember" />
        <span className="absolute inset-0 animate-ping rounded-full bg-ember/60" />
      </span>

      <div className="flex items-baseline justify-between gap-4 lg:pr-10">
        <span className="font-mono text-[10px] tracking-[0.25em] text-ember uppercase">
          {t.experience.moreSector}
        </span>
        <span className="font-mono text-sm text-smoke">∞</span>
      </div>

      <h3 className="mt-4 lg-short:mt-3 font-display-italic text-[1.9rem] leading-[1.05] text-ember md:text-[2.4rem] lg-short:text-[1.8rem]">
        {t.experience.moreTitle}
      </h3>
      <p className="mt-2 lg-short:mt-1.5 font-mono text-[10px] tracking-[0.2em] text-smoke uppercase">
        {t.experience.moreSubtitle}
      </p>

      <p className="mt-4 lg-short:mt-3 max-w-xs text-sm lg-short:text-[13px] leading-relaxed text-bone-dim lg:pr-8">
        {t.experience.moreText}
      </p>
    </article>
  )
}

/**
 * Professional history as a horizontal timeline. The intro (role, tenure,
 * lead-in and the magnetic Download-CV CTA) stays fixed while scroll scrubs the
 * connected node track sideways on desktop; touch/mobile gets a vertical
 * spine-and-node timeline. The layout is split into a compact intro zone and a
 * flex-1 track zone so the pinned content always fits one viewport height.
 */
export function Experience() {
  const { t } = useLanguage()
  const magneticRef = useMagnetic<HTMLDivElement>(0.3)
  const { ref: cvRef, scramble: scrambleCv } = useScramble<HTMLSpanElement>(
    t.experience.downloadCv,
  )

  const scopeRef = useGsapScope<HTMLElement>(({ root }) => {
    gsap.from(root.querySelectorAll('[data-node]'), {
      opacity: 0,
      y: 32,
      stagger: 0.08,
      duration: 0.9,
      scrollTrigger: { trigger: root, start: 'top 70%', once: true },
    })

    const track = root.querySelector<HTMLElement>('[data-track]')
    const spine = root.querySelector<HTMLElement>('[data-spine]')
    if (!track) return

    const mm = gsap.matchMedia()
    mm.add('(min-width: 1024px)', () => {
      const distance = () => track.scrollWidth - track.clientWidth
      // stretch the spine across the full scrollable width (not just the
      // visible viewport) so the line reaches the final node
      const sizeSpine = () => {
        if (spine) spine.style.width = `${track.scrollWidth}px`
      }

      gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          onRefresh: sizeSpine,
        },
      })
      sizeSpine()

      return () => {
        if (spine) spine.style.width = ''
      }
    })
    return () => mm.revert()
  })

  return (
    <section
      id="experience"
      ref={scopeRef}
      aria-label={t.experience.label}
      className="overflow-hidden"
    >
      <div className="flex flex-col px-5 pt-28 pb-20 md:px-8 md:pt-40 lg:h-svh lg:pt-0 lg:pb-0 lg:pl-24">
        {/* ── intro zone (compact, fixed height) ───────────────────── */}
        <div className="lg:shrink-0 lg:pt-20 lg-short:pt-10">
          <SectionHeading number="04" label={t.experience.label} />

          <div className="mt-8 flex flex-col gap-8 lg:mt-6 lg-short:mt-4 lg:flex-row lg:items-end lg:justify-between lg:gap-12 lg-short:gap-6">
            <div>
              <h2 className="wdth-condensed font-sans text-[clamp(3rem,6.5vw,6rem)] lg-short:text-[clamp(2.5rem,5.5vh,4.2rem)] leading-[0.9] font-bold uppercase">
                {t.experience.title}
              </h2>
              <p className="mt-3 lg-short:mt-2 font-mono text-[11px] tracking-[0.22em] uppercase">
                <span className="text-bone">{t.experience.role}</span>
                <span className="text-smoke"> · </span>
                <span className="text-ember">{t.experience.company}</span>
                <span className="text-smoke"> · {t.experience.period}</span>
              </p>
            </div>

            <div className="flex flex-col items-start gap-5 lg-short:gap-3 lg:max-w-sm lg:items-end lg:text-right">
              <p className="text-sm lg-short:text-[13px] leading-relaxed text-bone-dim">
                {t.experience.lead}
              </p>
              <div
                ref={magneticRef}
                className="inline-block"
                onPointerEnter={() => scrambleCv()}
              >
                <Button asChild variant="ember" size="pill" data-cursor="link">
                  <a href="/marcus-boni-cv.pdf" download>
                    <span ref={cvRef}>{t.experience.downloadCv}</span>
                    <span aria-hidden>↓</span>
                  </a>
                </Button>
              </div>
              <p
                data-cursor="drag"
                className="hidden font-mono text-[10px] tracking-[0.25em] text-smoke uppercase lg:block lg-short:hidden"
              >
                {t.experience.hint}
              </p>
            </div>
          </div>
        </div>

        {/* ── track zone (fills remaining height, vertically centred) ─ */}
        <div className="relative mt-14 lg:mt-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:justify-center">
          <div
            data-track
            className="relative flex flex-col gap-12 will-change-transform lg:flex-row lg:gap-24"
          >
            {/* timeline spine — horizontal on desktop (width set in JS),
                the stacked left borders form it on mobile */}
            <div
              data-spine
              aria-hidden
              className="absolute top-0 left-0 hidden h-px bg-line lg:block"
            />
            {experience.projects.map((project, index) => (
              <TimelineNode
                key={project.id}
                project={project}
                index={index}
                total={experience.projects.length}
              />
            ))}
            <OngoingNode />
          </div>
        </div>
      </div>
    </section>
  )
}
