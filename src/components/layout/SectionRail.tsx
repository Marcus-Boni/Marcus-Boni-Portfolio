import { useLenis } from 'lenis/react'

import { sectionIds } from '@/data/profile'
import { useActiveSection } from '@/hooks/useActiveSection'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { useLanguage } from '@/i18n/LanguageContext'
import { cn } from '@/lib/utils'

/**
 * Fixed vertical index on the left edge — the site's primary wayfinding.
 * Follows the active section (`useActiveSection`).
 *
 * Everything stays inside the page gutter. The active section's name runs
 * vertically up the page edge like a running head, so it is always readable
 * and never sits on top of the content beside the rail; the horizontal label
 * of any other section appears only on hover or keyboard focus.
 */
export function SectionRail() {
  const isDesktop = useIsDesktop()
  const active = useActiveSection()
  const lenis = useLenis()
  const { t } = useLanguage()

  if (!isDesktop) return null

  return (
    <nav
      aria-label={t.sections.rail}
      // over the hero the source field steps back for the rail (see `CodeField`)
      data-field-quiet
      className="fixed left-3 top-1/2 z-30 flex -translate-y-1/2 items-center gap-2.5"
    >
      <span
        aria-hidden
        className="flex h-28 w-3 rotate-180 items-center justify-center overflow-hidden font-mono text-[10px] leading-none tracking-[0.3em] text-bone-dim uppercase [writing-mode:vertical-rl]"
      >
        {/* keyed so each new section name plays the entrance again */}
        <span key={active} className="animate-rail-label whitespace-nowrap">
          {t.sections[active]}
        </span>
      </span>

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
                    'block h-px transition-[width,background-color,opacity] duration-500 ease-out-expo',
                    isActive
                      ? 'w-7 bg-ember'
                      : 'w-4 bg-bone opacity-40 group-hover:w-7 group-hover:opacity-80',
                  )}
                />
                <span className="-translate-x-2 bg-ink/90 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.2em] text-bone uppercase opacity-0 transition-[opacity,translate] duration-300 ease-out-expo group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
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
