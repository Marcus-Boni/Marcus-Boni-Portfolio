import { CodeField } from '@/components/canvas/CodeField'
import { useSiteContent } from '@/content/SiteContentContext'
import { useScrollReveal, useGsapScope } from '@/hooks/useScrollReveal'
import { useLanguage } from '@/i18n/LanguageContext'
import { gsap } from '@/animations/gsap'
import { shouldSkipIntro } from '@/lib/defer'

/**
 * Full-viewport hero: the source field behind a massive typographic lockup.
 * The name splits into characters and pours in; metadata fades after.
 */
export function Hero() {
  const { t } = useLanguage()
  const { content } = useSiteContent()
  const { profile } = content
  const firstNameRef = useScrollReveal<HTMLSpanElement>({
    mode: 'chars',
    stagger: 0.035,
    immediate: true,
    delay: 0.45,
  })
  const lastNameRef = useScrollReveal<HTMLSpanElement>({
    mode: 'chars',
    stagger: 0.045,
    immediate: true,
    delay: 0.75,
  })

  const scopeRef = useGsapScope<HTMLElement>(({ root }) => {
    // On slow loads the static shell already painted this content — don't
    // hide it again just to fade it back in (see shouldSkipIntro).
    if (!shouldSkipIntro()) {
      gsap.from('[data-hero-fade]', {
        opacity: 0,
        y: 24,
        duration: 1.1,
        stagger: 0.12,
        delay: 1.3,
      })
    }
    gsap.to('[data-hero-meta]', {
      opacity: 0,
      y: -40,
      scrollTrigger: {
        trigger: root,
        start: 'top top',
        end: '60% top',
        scrub: true,
      },
    })
  })

  return (
    <section
      id="hero"
      ref={scopeRef}
      className="relative flex h-svh flex-col justify-end overflow-hidden"
      aria-label={t.sections.hero}
    >
      {/* static backdrop, painted immediately; the source field prints over it */}
      <div aria-hidden className="hero-backdrop absolute inset-0" />
      <CodeField />

      {/* metadata strip pinned near the top */}
      <div
        data-hero-meta
        className="pointer-events-none absolute top-24 right-5 left-5 flex justify-between font-mono text-[10px] tracking-[0.25em] text-bone-dim uppercase md:top-28 md:right-8 md:left-24 lg-short:top-14"
      >
        <span data-hero-fade data-field-quiet>
          {t.hero.portfolio} — {new Date().getFullYear()}
        </span>
        {profile.available && (
          <span data-hero-fade data-field-quiet>
            {t.hero.available}
          </span>
        )}
      </div>

      <div className="relative z-10 px-5 pb-10 md:px-8 md:pb-14 lg:pl-24 lg-short:pb-6">
        {/* `data-field-quiet`: the source field steps back around these */}
        <p
          data-hero-fade
          data-field-quiet
          className="mb-4 max-w-md font-mono text-[11px] leading-relaxed tracking-[0.18em] text-bone-dim uppercase md:mb-6 lg-short:mb-2"
        >
          {t.hero.intro}
        </p>

        <h1 className="flex flex-col" aria-label={profile.name} data-field-quiet="veins">
          <span
            ref={firstNameRef}
            data-reveal
            className="wdth-expanded font-sans text-giant leading-[0.86] font-bold tracking-tight uppercase lg-short:text-[clamp(3.5rem,15vh,7rem)]"
          >
            Marcus
          </span>
          <span className="flex items-baseline gap-[0.12em]">
            <span
              ref={lastNameRef}
              data-reveal
              className="font-display-italic text-giant leading-[0.92] text-ember lg-short:text-[clamp(3.5rem,15vh,7rem)]"
            >
              Boni
            </span>
            <span
              data-hero-fade
              data-field-quiet
              className="hidden font-mono text-xs tracking-[0.2em] text-smoke sm:inline"
            >
              ©{new Date().getFullYear()}
            </span>
          </span>
        </h1>

        <div
          data-hero-fade
          className="mt-8 flex items-end justify-between border-t border-line pt-5 lg-short:mt-4 lg-short:pt-3"
        >
          <p
            data-field-quiet
            className="max-w-xs font-sans text-sm leading-relaxed text-bone-dim md:max-w-sm md:text-base"
          >
            {t.hero.tagline}
          </p>
          <div
            data-field-quiet
            className="flex flex-col items-end gap-1 font-mono text-[10px] tracking-[0.25em] text-smoke uppercase"
          >
            <span>{t.hero.scrollLine1}</span>
            <span className="flex items-center gap-3">
              {t.hero.scrollLine2}
              {/* a signal running down a hairline, in place of a bouncing arrow */}
              <span aria-hidden className="relative block h-7 w-px overflow-hidden bg-line">
                <span className="absolute inset-x-0 top-0 block h-3 animate-scroll-cue bg-ember" />
              </span>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
