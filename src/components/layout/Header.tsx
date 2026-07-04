import { AnimatePresence, motion } from 'framer-motion'
import { useLenis } from 'lenis/react'
import { useEffect, useState } from 'react'

import { useSiteContent } from '@/content/SiteContentContext'
import { sectionIds } from '@/data/profile'
import { useMagnetic } from '@/hooks/useMagnetic'
import { useScrollHeader } from '@/hooks/useScrollHeader'
import { useLanguage } from '@/i18n/LanguageContext'
import type { Locale } from '@/i18n/translations'
import { HoverItalic } from '@/components/ui/HoverItalic'
import { cn } from '@/lib/utils'

function LiveClock() {
  const [time, setTime] = useState(() => formatTime())

  function formatTime() {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date())
  }

  useEffect(() => {
    const id = setInterval(() => setTime(formatTime()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <span className="tabular-nums" suppressHydrationWarning>
      {time}
    </span>
  )
}

function LanguageToggle() {
  const { locale, setLocale } = useLanguage()
  const options: Locale[] = ['pt', 'en']

  return (
    <div
      className="flex items-center gap-2 font-mono text-[11px] tracking-[0.18em]"
      role="group"
      aria-label="Language"
    >
      {options.map((option, index) => (
        <span key={option} className="flex items-center gap-2">
          {index > 0 && <span className="text-smoke">/</span>}
          <button
            onClick={() => setLocale(option)}
            aria-pressed={locale === option}
            className={cn(
              'uppercase transition-colors duration-300',
              locale === option ? 'text-ember' : 'text-bone/50 hover:text-bone',
            )}
          >
            {option}
          </button>
        </span>
      ))}
    </div>
  )
}

const overlayVariants = {
  closed: { clipPath: 'inset(0% 0% 100% 0%)' },
  open: { clipPath: 'inset(0% 0% 0% 0%)' },
}

export function Header() {
  const [open, setOpen] = useState(false)
  const lenis = useLenis()
  const { t } = useLanguage()
  const { content } = useSiteContent()
  const { profile, socials } = content
  const { scrolled, hidden } = useScrollHeader(open)
  const menuButtonRef = useMagnetic<HTMLButtonElement>(0.3)

  useEffect(() => {
    if (open) lenis?.stop()
    else lenis?.start()
  }, [open, lenis])

  const goTo = (id: string) => {
    setOpen(false)
    // wait a beat for the overlay to start closing before scrolling
    window.setTimeout(() => {
      const target = document.getElementById(id)
      if (!target) return
      if (lenis) lenis.scrollTo(target, { duration: 1.6 })
      else target.scrollIntoView({ behavior: 'smooth' })
    }, 350)
  }

  return (
    <>
      <motion.header
        initial={false}
        animate={{ y: hidden ? '-115%' : '0%' }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-x-0 top-0 z-50"
      >
        {/* glass layer — fades in once scrolled past the fold */}
        <div
          aria-hidden
          className={cn(
            'absolute inset-0 -z-10 border-b backdrop-blur-xl transition-opacity duration-500',
            'border-line/60 bg-ink/55 shadow-[0_12px_44px_-22px_rgba(0,0,0,0.85)]',
            scrolled && !open ? 'opacity-100' : 'opacity-0',
          )}
        />
        <div className="flex items-center justify-between px-5 py-4 md:px-8">
          <button
            onClick={() => goTo('hero')}
            className="font-display-italic text-2xl leading-none text-bone"
            aria-label={t.header.backHome}
          >
            mb<span className="text-ember">.</span>
          </button>

          <div className="hidden items-center gap-8 font-mono text-[11px] tracking-[0.18em] text-bone md:flex">
            <span>{profile.locationShort}</span>
            <LiveClock />
          </div>

          <div className="flex items-center gap-6 md:gap-8">
            <LanguageToggle />
            <button
              ref={menuButtonRef}
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-label={open ? t.header.closeMenu : t.header.openMenu}
              className="group flex h-11 items-center gap-3 font-mono text-[11px] tracking-[0.22em] text-bone"
            >
              <span>{open ? t.header.close : t.header.menu}</span>
              <span className="relative block h-[10px] w-7">
                <span
                  className={cn(
                    'absolute left-0 top-0 h-px w-full bg-bone transition-transform duration-300',
                    open && 'translate-y-[4.5px] rotate-45',
                  )}
                />
                <span
                  className={cn(
                    'absolute bottom-0 left-0 h-px w-full bg-bone transition-transform duration-300',
                    open && '-translate-y-[4.5px] -rotate-45',
                  )}
                />
              </span>
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.nav
            key="menu"
            initial="closed"
            animate="open"
            exit="closed"
            variants={overlayVariants}
            transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }}
            className="fixed inset-0 z-40 flex flex-col justify-between overflow-y-auto bg-ink-soft px-5 pb-10 pt-28 md:px-8 lg-short:pt-20 lg-short:pb-6"
          >
            <ul className="flex flex-col gap-1 lg-short:gap-0">
              {sectionIds.map((id, index) => (
                <motion.li
                  key={id}
                  initial={{ y: 80, opacity: 0 }}
                  animate={{
                    y: 0,
                    opacity: 1,
                    transition: {
                      delay: 0.25 + index * 0.07,
                      duration: 0.7,
                      ease: [0.16, 1, 0.3, 1],
                    },
                  }}
                  exit={{ opacity: 0, transition: { duration: 0.2 } }}
                >
                  <button
                    onClick={() => goTo(id)}
                    data-cursor="link"
                    className="group flex items-baseline gap-4 py-1 text-left lg-short:py-0.5"
                  >
                    <span className="font-mono text-xs text-smoke transition-colors duration-300 group-hover:text-ember">
                      0{index + 1}
                    </span>
                    <HoverItalic
                      text={t.sections[id]}
                      className="text-[clamp(2.5rem,8vw,5.5rem)] leading-[1.05] text-bone transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-3 lg-short:text-[clamp(2rem,7vh,3.5rem)]"
                    />
                    <span
                      aria-hidden
                      className="-translate-x-4 font-display-italic text-2xl text-ember opacity-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0 group-hover:opacity-100 md:text-4xl"
                    >
                      ↗
                    </span>
                  </button>
                </motion.li>
              ))}
            </ul>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.6 } }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              className="flex flex-wrap items-end justify-between gap-6"
            >
              <div className="flex gap-6 font-mono text-[11px] tracking-[0.18em] text-smoke">
                {socials.map((social) => (
                  <a
                    key={social.label}
                    href={social.url}
                    target="_blank"
                    rel="noreferrer"
                    data-cursor="link"
                    className="group relative transition-colors hover:text-ember"
                  >
                    {social.label.toUpperCase()}
                    <span className="absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-ember transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100" />
                  </a>
                ))}
              </div>
              <p className="font-mono text-[11px] tracking-[0.18em] text-smoke">
                {profile.location.toUpperCase()}
              </p>
            </motion.div>
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  )
}
