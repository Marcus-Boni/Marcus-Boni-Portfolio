import { useEffect, useState } from 'react'

import { sectionIds, type SectionId } from '@/data/profile'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { useLanguage } from '@/i18n/LanguageContext'

/**
 * The home section crossing the middle of the screen, `hero` until one does.
 * Only tracked from 1024px, where the things that follow it exist (the section
 * rail, the code tooth). On a page without those sections it stays `hero`.
 */
export function useActiveSection(): SectionId {
  const isDesktop = useIsDesktop()
  const [active, setActive] = useState<SectionId>('hero')
  const { locale } = useLanguage()

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
    // `locale` re-keys <main>, which remounts every section: observe the new
    // nodes or this goes on watching elements that left the document.
  }, [isDesktop, locale])

  return active
}
