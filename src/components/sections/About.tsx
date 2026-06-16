import { profile } from '@/data/profile'
import { useGsapScope, useScrollReveal } from '@/hooks/useScrollReveal'
import { useLanguage } from '@/i18n/LanguageContext'
import { gsap } from '@/animations/gsap'
import { BIRTH_DATE, calculateAge } from '@/lib/age'
import { SectionHeading } from '@/components/ui/SectionHeading'

/**
 * Editorial about: an oversized serif statement revealed line by line,
 * a parallax duotone portrait, and a mono fact sheet.
 */
export function About() {
  const { t } = useLanguage()
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
            <p>{t.about.p1}</p>
            <p>{t.about.p2}</p>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="relative ml-auto aspect-[3/4] max-w-xs overflow-hidden lg:-mt-10">
            <img
              data-portrait
              src={profile.avatar}
              alt={t.about.portraitAlt}
              loading="lazy"
              decoding="async"
              width={480}
              height={480}
              className="h-[116%] w-full object-cover grayscale transition-all duration-700 hover:grayscale-0"
            />
            <span className="absolute bottom-3 left-3 bg-ink/80 px-3 py-1 font-mono text-[10px] tracking-[0.25em] text-ember uppercase">
              {t.about.figcaption}
            </span>
          </div>
        </div>
      </div>

      <dl
        data-facts
        className="mt-24 grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4"
      >
        {t.about.facts.map((fact) => (
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
