import { useState } from 'react'

import { techStack } from '@/data/profile'
import { gsap } from '@/animations/gsap'
import { useGsapScope } from '@/hooks/useScrollReveal'
import { useLanguage } from '@/i18n/LanguageContext'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { cn } from '@/lib/utils'

/**
 * The stack as an editorial index: dense hoverable rows that ignite on
 * contact, grouped by discipline.
 */
export function Stack() {
  const { t } = useLanguage()
  const [hovered, setHovered] = useState<string | null>(null)

  const scopeRef = useGsapScope<HTMLElement>(({ root }) => {
    gsap.from(root.querySelectorAll('[data-row]'), {
      opacity: 0,
      y: 32,
      stagger: 0.045,
      duration: 0.9,
      scrollTrigger: {
        trigger: root.querySelector('[data-rows]'),
        start: 'top 80%',
        once: true,
      },
    })
  })

  return (
    <section
      id="craft"
      ref={scopeRef}
      className="px-5 py-28 md:px-8 md:py-40 lg:pl-24"
      aria-label={t.craft.label}
    >
      <SectionHeading number="03" label={t.craft.label} />

      <div className="mt-14 grid gap-12 lg:grid-cols-12">
        <p className="font-display text-editorial leading-[1.15] lg:col-span-5">
          {t.craft.statement}
        </p>

        <ul data-rows className="lg:col-span-7" role="list">
          {techStack.map((tech, index) => {
            const isHovered = hovered === tech.name
            return (
              <li
                key={tech.name}
                data-row
                onPointerEnter={() => setHovered(tech.name)}
                onPointerLeave={() => setHovered(null)}
                className={cn(
                  'flex cursor-default items-baseline justify-between gap-4 border-b border-line py-4 transition-colors duration-300 md:py-5',
                  isHovered && 'border-ember',
                )}
              >
                <span className="flex items-baseline gap-5">
                  <span
                    className={cn(
                      'font-mono text-[10px] tracking-[0.2em] transition-colors duration-300',
                      isHovered ? 'text-ember' : 'text-smoke',
                    )}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span
                    className={cn(
                      'wdth-expanded font-sans text-2xl font-semibold uppercase transition-all duration-300 md:text-4xl',
                      isHovered ? 'translate-x-3 text-ember' : 'text-bone',
                    )}
                  >
                    {tech.name}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[10px] tracking-[0.25em] text-smoke uppercase">
                  {t.craft.categories[tech.category]}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
