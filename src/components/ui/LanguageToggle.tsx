import { useLanguage } from '@/i18n/LanguageContext'
import type { Locale } from '@/i18n/translations'
import { transitionLocale } from '@/lib/locale-transition'
import { cn } from '@/lib/utils'

const OPTIONS: readonly Locale[] = ['pt', 'en']

interface LanguageToggleProps {
  /** Overrides which option appears active (e.g. on `/en/blog`). */
  activeLocale?: Locale
  /**
   * Custom handler when the reader selects a language. When omitted, commits
   * `setLocale(next)` inside `transitionLocale`.
   */
  onSelect?: (next: Locale) => void
  className?: string
}

/**
 * Tactile PT / EN switcher shared by the portfolio header and the journal
 * header. A 1px ember underline glides smoothly between the two equal-width
 * slots with exponential easing, and switching triggers the directional
 * View Transition.
 */
export function LanguageToggle({
  activeLocale,
  onSelect,
  className,
}: LanguageToggleProps) {
  const { locale, setLocale } = useLanguage()
  const active = activeLocale ?? locale

  const handleSelect = (option: Locale) => {
    if (onSelect) {
      onSelect(option)
      return
    }
    if (option === active) return
    transitionLocale(option, () => setLocale(option))
  }

  return (
    <div
      className={cn(
        'relative grid grid-cols-2 items-center font-mono text-[11px] tracking-[0.18em]',
        className,
      )}
      role="group"
      aria-label="Language"
    >
      {/* Vertical divider centred between the two equal-width slots */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 h-2.5 w-px -translate-x-1/2 -translate-y-1/2 bg-line"
      />
      {/* Gliding Signal & Ink ember hairline under the active language */}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute bottom-1 left-0 h-px w-1/2 px-1.5 transition-transform duration-500 ease-out-expo',
          active === 'en' ? 'translate-x-full' : 'translate-x-0',
        )}
      >
        <span className="block h-full w-full bg-ember" />
      </span>

      {OPTIONS.map((option) => {
        const selected = active === option
        return (
          <button
            key={option}
            type="button"
            onClick={() => handleSelect(option)}
            aria-pressed={selected}
            className={cn(
              'relative min-h-8 min-w-8 px-2 text-center uppercase transition-colors duration-300',
              selected ? 'text-ember' : 'text-smoke hover:text-bone',
            )}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}
