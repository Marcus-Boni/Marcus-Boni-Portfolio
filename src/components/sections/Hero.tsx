import { Suspense, lazy } from 'react'

import { useSiteContent } from '@/content/SiteContentContext'
import { useDeferredActivation } from '@/hooks/useDeferredActivation'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useScrollReveal, useGsapScope } from '@/hooks/useScrollReveal'
import { useLanguage } from '@/i18n/LanguageContext'
import { gsap } from '@/animations/gsap'
import { shouldSkipIntro } from '@/lib/defer'

const InkFieldScene = lazy(() =>
  import('@/components/canvas/InkFieldScene').then((module) => ({
    default: module.InkFieldScene,
  })),
)

/** Painted instantly behind the hero — the loading + reduced-motion state. */
const HERO_BACKDROP =
  'radial-gradient(120% 90% at 70% 20%, #1c1815 0%, #0d0c0a 60%)'

/**
 * Full-viewport hero: WebGL ink field behind a massive typographic lockup.
 * The name splits into characters and pours in; metadata fades after.
 */
export function Hero() {
  const { t } = useLanguage()
  const { content } = useSiteContent()
  const { profile } = content
  const reduced = usePrefersReducedMotion()
  const showCanvas = useDeferredActivation() && !reduced
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
      aria-label="Apresentação"
    >
      {/* static backdrop, painted immediately — the WebGL canvas mounts over
          it only after the first user interaction so it never blocks load */}
      <div aria-hidden className="absolute inset-0" style={{ background: HERO_BACKDROP }} />
      {showCanvas && (
        <Suspense fallback={null}>
          <InkFieldScene />
        </Suspense>
      )}

      {/* metadata strip pinned near the top */}
      <div
        data-hero-meta
        className="pointer-events-none absolute top-24 right-5 left-5 flex justify-between font-mono text-[10px] tracking-[0.25em] text-bone-dim uppercase md:top-28 md:right-8 md:left-24 lg-short:top-14"
      >
        <span data-hero-fade>
          {t.hero.portfolio} — {new Date().getFullYear()}
        </span>
        {profile.available && <span data-hero-fade>{t.hero.available}</span>}
      </div>

      <div className="relative z-10 px-5 pb-10 md:px-8 md:pb-14 lg:pl-24 lg-short:pb-6">
        <p
          data-hero-fade
          className="mb-4 max-w-md font-mono text-[11px] leading-relaxed tracking-[0.18em] text-bone-dim uppercase md:mb-6 lg-short:mb-2"
        >
          {t.hero.intro}
        </p>

        <h1 className="flex flex-col" aria-label={profile.name}>
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
          <p className="max-w-xs font-sans text-sm leading-relaxed text-bone-dim md:max-w-sm md:text-base">
            {t.hero.tagline}
          </p>
          <div className="flex flex-col items-end gap-1 font-mono text-[10px] tracking-[0.25em] text-smoke uppercase">
            <span>{t.hero.scrollLine1}</span>
            <span className="flex items-center gap-2">
              {t.hero.scrollLine2}
              <span className="inline-block animate-bounce text-ember">↓</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
