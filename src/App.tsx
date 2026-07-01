import { useEffect } from 'react'

import { Cursor } from '@/components/cursor/Cursor'
import { Header } from '@/components/layout/Header'
import { SectionRail } from '@/components/layout/SectionRail'
import { SmoothScroll } from '@/components/layout/SmoothScroll'
import { About } from '@/components/sections/About'
import { Contact } from '@/components/sections/Contact'
import { Experience } from '@/components/sections/Experience'
import { Hero } from '@/components/sections/Hero'
import { Stack } from '@/components/sections/Stack'
import { Work } from '@/components/sections/Work'
import { Marquee } from '@/components/ui/Marquee'
import { sectionIds } from '@/data/profile'
import { usePointerTracking } from '@/hooks/usePointer'
import { useLanguage } from '@/i18n/LanguageContext'
import { trackEvent } from '@/lib/analytics'

const techMarquee = [
  'React',
  'TypeScript',
  'Next.js',
  'Node.js',
  'Python',
  'C#',
  'PostgreSQL',
  'Docker',
  'Azure',
]

/** Fire one pageview, then a one-time `section_view` as each section appears. */
function usePageTracking() {
  useEffect(() => {
    trackEvent('pageview')

    const seen = new Set<string>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id
          if (entry.isIntersecting && !seen.has(id)) {
            seen.add(id)
            trackEvent('section_view', { section: id })
          }
        }
      },
      { threshold: 0.4 },
    )

    sectionIds.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])
}

export default function App() {
  usePointerTracking()
  usePageTracking()
  const { locale, t } = useLanguage()

  return (
    <SmoothScroll>
      <Cursor />
      <Header />
      <SectionRail />

      {/* keyed by locale: text reveals re-split and ScrollTriggers rebuild */}
      <main key={locale}>
        <Hero />
        <Marquee items={techMarquee} className="mt-px" repeat={2} />
        <About />
        <Work />
        <Experience />
        <Marquee items={t.marquee} reverse repeat={4} />
        <Stack />
        <Contact />
      </main>

      <div aria-hidden className="grain z-[90]" />
    </SmoothScroll>
  )
}
