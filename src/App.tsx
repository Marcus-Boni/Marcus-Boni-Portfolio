import { Cursor } from '@/components/cursor/Cursor'
import { Header } from '@/components/layout/Header'
import { SectionRail } from '@/components/layout/SectionRail'
import { SmoothScroll } from '@/components/layout/SmoothScroll'
import { About } from '@/components/sections/About'
import { Contact } from '@/components/sections/Contact'
import { Hero } from '@/components/sections/Hero'
import { Stack } from '@/components/sections/Stack'
import { Work } from '@/components/sections/Work'
import { Marquee } from '@/components/ui/Marquee'
import { usePointerTracking } from '@/hooks/usePointer'
import { LanguageProvider, useLanguage } from '@/i18n/LanguageContext'

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

function Site() {
  usePointerTracking()
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
        <Marquee items={t.marquee} reverse repeat={4} />
        <Stack />
        <Contact />
      </main>

      <div aria-hidden className="grain z-[90]" />
    </SmoothScroll>
  )
}

export default function App() {
  return (
    <LanguageProvider>
      <Site />
    </LanguageProvider>
  )
}
