import { profile, socials } from '@/data/profile'
import { useMagnetic } from '@/hooks/useMagnetic'
import { useScramble } from '@/hooks/useScramble'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { useLanguage } from '@/i18n/LanguageContext'
import { Button } from '@/components/ui/button'
import { SectionHeading } from '@/components/ui/SectionHeading'

/**
 * Closing statement and contact. A giant serif invitation, one magnetic
 * call-to-action, and the social index as a footer colophon.
 */
export function Contact() {
  const { t } = useLanguage()
  const titleRef = useScrollReveal<HTMLHeadingElement>({
    mode: 'lines',
    stagger: 0.12,
  })
  const magneticRef = useMagnetic<HTMLDivElement>(0.25)
  const { ref: ctaRef, scramble: scrambleCta } = useScramble<HTMLSpanElement>(
    t.contact.cta,
  )

  return (
    <section
      id="contact"
      className="relative flex min-h-svh flex-col justify-between px-5 pt-28 md:px-8 md:pt-40 lg:pl-24"
      aria-label={t.sections.contact}
    >
      <div>
        <SectionHeading number="06" label={t.contact.label} />

        <h2
          ref={titleRef}
          data-reveal
          className="mt-14 font-display text-[clamp(3rem,9.5vw,9rem)] leading-[1.02]"
        >
          {t.contact.title}
        </h2>

        <div className="mt-16 flex flex-col items-start gap-10 md:flex-row md:items-center md:gap-16">
          <div
            ref={magneticRef}
            className="inline-block"
            onPointerEnter={() => scrambleCta()}
          >
            <Button asChild size="pill" variant="ember" data-cursor="link">
              <a href={`mailto:${profile.email}`}>
                <span ref={ctaRef}>{t.contact.cta}</span>
              </a>
            </Button>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-bone-dim">
            {t.contact.blurb}
          </p>
        </div>
      </div>

      <footer className="mt-28 border-t border-line py-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <ul className="flex flex-col gap-6 sm:flex-row sm:gap-x-10 sm:gap-y-3" role="list">
            {socials.map((social) => (
              <li key={social.label}>
                <a
                  href={social.url}
                  target="_blank"
                  rel="noreferrer"
                  data-cursor="link"
                  className="group flex flex-col gap-1"
                >
                  <span className="font-mono text-[10px] tracking-[0.25em] text-smoke uppercase">
                    {social.label}
                  </span>
                  <span className="relative w-fit text-sm text-bone transition-colors duration-300 group-hover:text-ember">
                    {social.handle}
                    <span className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-ember transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100" />
                  </span>
                </a>
              </li>
            ))}
          </ul>

          <div className="flex flex-col items-start gap-1 text-left md:items-end md:text-right">
            <span className="font-display-italic text-2xl">
              mb<span className="text-ember">.</span>
            </span>
            <span className="font-mono text-[10px] tracking-[0.2em] text-smoke uppercase">
              © {new Date().getFullYear()} {profile.name}
            </span>
          </div>
        </div>
      </footer>
    </section>
  )
}
