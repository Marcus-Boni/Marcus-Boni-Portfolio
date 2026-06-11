import { useEffect, useState } from 'react'
import { useLenis } from 'lenis/react'

import { sectionIds, type SectionId } from '@/data/profile'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { useLanguage } from '@/i18n/LanguageContext'
import { cn } from '@/lib/utils'

/**
 * Fixed vertical index on the left edge — the site's primary wayfinding.
 * Tracks the active section with an IntersectionObserver.
 */
export function SectionRail() {
  const isDesktop = useIsDesktop()
  const [active, setActive] = useState<SectionId>('hero')
  const lenis = useLenis()
  const { t } = useLanguage()

  useEffect(() => {
    if (!isDesktop) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id as SectionId)
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    )
    for (const id of sectionIds) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [isDesktop])

  if (!isDesktop) return null

  return (
    <nav
      aria-label="Seções"
      className="fixed left-8 top-1/2 z-30 -translate-y-1/2 mix-blend-difference"
    >
      <ul className="flex flex-col gap-5">
        {sectionIds.map((id, index) => {
          const isActive = active === id
          return (
            <li key={id}>
              <button
                onClick={() => {
                  const el = document.getElementById(id)
                  if (!el) return
                  if (lenis) lenis.scrollTo(el, { duration: 1.6 })
                  else el.scrollIntoView({ behavior: 'smooth' })
                }}
                data-cursor="link"
                className="group flex items-center gap-3"
                aria-current={isActive ? 'true' : undefined}
              >
                <span
                  className={cn(
                    'font-mono text-[10px] tracking-[0.2em] transition-colors duration-300',
                    isActive ? 'text-ember' : 'text-smoke group-hover:text-bone',
                  )}
                >
                  0{index + 1}
                </span>
                <span
                  className={cn(
                    'block h-px bg-bone transition-all duration-500',
                    isActive ? 'w-10 bg-ember' : 'w-4 opacity-40 group-hover:w-7 group-hover:opacity-80',
                  )}
                />
                <span
                  className={cn(
                    'font-mono text-[10px] tracking-[0.2em] uppercase transition-all duration-300',
                    isActive
                      ? 'translate-x-0 text-bone opacity-100'
                      : '-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-60',
                  )}
                >
                  {t.sections[id]}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
