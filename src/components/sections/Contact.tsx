import { profile, socials } from '@/data/profile'
import { useMagnetic } from '@/hooks/useMagnetic'
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

  return (
    <section
      id="contact"
      className="relative flex min-h-svh flex-col justify-between px-5 pt-28 md:px-8 md:pt-40 lg:pl-24"
      aria-label={t.sections.contact}
    >
      <div>
        <SectionHeading number="04" label={t.contact.label} />

        <h2
          ref={titleRef}
          data-reveal
          className="mt-14 font-display text-[clamp(3rem,9.5vw,9rem)] leading-[1.02]"
        >
          {t.contact.title}
        </h2>

        <div className="mt-16 flex flex-col items-start gap-10 md:flex-row md:items-center md:gap-16">
          <div ref={magneticRef} className="inline-block">
            <Button asChild size="pill" variant="ember" data-cursor="link">
              <a href={`mailto:${profile.email}`}>{t.contact.cta}</a>
            </Button>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-bone-dim">
            {t.contact.blurb}
          </p>
        </div>
      </div>

      <footer className="mt-28 border-t border-line py-8">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <ul className="flex flex-wrap gap-x-10 gap-y-3" role="list">
            {socials.map((social) => (
              <li key={social.label}>
                <a
                  href={social.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex flex-col gap-1"
                >
                  <span className="font-mono text-[10px] tracking-[0.25em] text-smoke uppercase">
                    {social.label}
                  </span>
                  <span className="text-sm text-bone transition-colors group-hover:text-ember">
                    {social.handle}
                  </span>
                </a>
              </li>
            ))}
          </ul>

          <div className="flex flex-col items-end gap-1 text-right">
            <span className="font-display-italic text-2xl">
              mb<span className="text-ember">.</span>
            </span>
            <span className="font-mono text-[10px] tracking-[0.2em] text-smoke uppercase">
              © {new Date().getFullYear()} {profile.name} — {t.contact.madeIn}
            </span>
          </div>
        </div>
      </footer>
    </section>
  )
}
