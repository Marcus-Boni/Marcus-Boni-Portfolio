import { useLanguage } from '@/i18n/LanguageContext'
import { themeSupported, toggleTheme, useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

/**
 * The colour scheme switch in both headers: a disc, half ink and half paper,
 * that turns over. Its name says what pressing it does, so it needs no
 * pressed state.
 */
export function ThemeToggle() {
  const { t } = useLanguage()
  const theme = useTheme()
  if (!themeSupported) return null

  return (
    <button
      type="button"
      onClick={(event) => {
        // from the disc itself: a keyboard "click" carries no coordinates
        const box = event.currentTarget.getBoundingClientRect()
        toggleTheme({ x: box.left + box.width / 2, y: box.top + box.height / 2 })
      }}
      aria-label={theme === 'dark' ? t.header.themeToLight : t.header.themeToDark}
      className="flex h-11 w-6 items-center justify-center text-bone-dim transition-colors duration-300 hover:text-ember"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className={cn(
          'size-3.5 transition-transform duration-700 ease-out-expo',
          theme === 'light' && 'rotate-180',
        )}
      >
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" />
        <path d="M8 1.5a6.5 6.5 0 0 1 0 13Z" fill="currentColor" />
      </svg>
    </button>
  )
}
