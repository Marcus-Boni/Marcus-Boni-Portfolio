import { useSiteContent } from '@/content/SiteContentContext'
import { useGsapScope, useScrollReveal } from '@/hooks/useScrollReveal'
import { useLanguage } from '@/i18n/LanguageContext'
import { gsap } from '@/animations/gsap'
import { BIRTH_DATE, calculateAge } from '@/lib/age'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { CodePortrait } from '@/components/ui/CodePortrait'

/**
 * Editorial about: an oversized serif statement revealed line by line,
 * a portrait assembled from code, and a mono fact sheet.
 */
export function About() {
  const { t } = useLanguage()
  const { content } = useSiteContent()
  const { profile } = content
  // Older CMS content points to the GitHub redirect. The same author portrait
  // is already hosted locally, optimized and safe to sample into a canvas.
  const portraitSrc = /^https:\/\/github\.com\/Marcus-Boni\.png(?:\?.*)?$/.test(profile.avatar)
    ? '/portrait-640.webp' : profile.avatar
  const age = calculateAge(BIRTH_DATE)
  const statementRef = useScrollReveal<HTMLParagraphElement>({
    mode: 'lines',
    stagger: 0.1,
  })

  const scopeRef = useGsapScope<HTMLElement>(({ root }) => {
    gsap.fromTo(
      root.querySelector('[data-portrait]'),
      { yPercent: -8 },
      {
        yPercent: 8,
        ease: 'none',
        scrollTrigger: {
          trigger: root,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      },
    )
    gsap.from(root.querySelectorAll('[data-fact]'), {
      opacity: 0,
      y: 28,
      stagger: 0.08,
      scrollTrigger: {
        trigger: root.querySelector('[data-facts]'),
        start: 'top 85%',
        once: true,
      },
    })
  })

  return (
    <section
      id="about"
      ref={scopeRef}
      className="relative px-5 py-28 md:px-8 md:py-40 lg:pl-24"
      aria-label={t.about.label}
    >
      <SectionHeading number="02" label={t.about.label} />

      <div className="mt-14 grid gap-16 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-8">
          <p
            ref={statementRef}
            data-reveal
            className="font-display text-editorial leading-[1.12] text-bone"
          >
            {t.about.statement(age)}
          </p>

          <div className="mt-16 max-w-xl space-y-5 text-base leading-relaxed text-bone-dim lg:ml-[20%]">
            <p>{t.about.p1(profile.repoCount)}</p>
            <p>{t.about.p2}</p>
          </div>
        </div>

        <div className="lg:col-span-4">
          <CodePortrait src={portraitSrc} alt={t.about.portraitAlt}
            caption={t.about.figcaption} />
        </div>
      </div>

      <dl
        data-facts
        className="mt-24 grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4"
      >
        {t.about.facts(profile.repoCount).map((fact) => (
          <div key={fact.label} data-fact className="bg-ink p-5 md:p-6">
            <dt className="font-mono text-[10px] tracking-[0.25em] text-smoke uppercase">
              {fact.label}
            </dt>
            <dd className="mt-3 font-display text-2xl text-bone md:text-3xl">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
