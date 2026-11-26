import { AnimatePresence, motion, type Variants } from 'framer-motion'

import { cn } from '@/lib/utils'

/**
 * Full Kokonut UI `AI-04` (AI Text Loading) ported to Signal & Ink.
 *
 * Each phrase enters letter-by-letter with a subtle blur settle (`EASE_OUT`)
 * and runs a left-to-right opacity brightness wave across characters without
 * using gradient text. Under `prefers-reduced-motion`, `<MotionConfig>` keeps
 * swaps instant and CSS disables the wave.
 */

const EASE_OUT = [0.23, 1, 0.32, 1] as const
const WAVE_STEP = 0.055

const wordVariants: Variants = {
  enter: {},
  shown: { transition: { staggerChildren: 0.016 } },
  exit: {
    opacity: 0,
    y: -5,
    filter: 'blur(3px)',
    transition: { duration: 0.14, ease: EASE_OUT },
  },
}

const letterVariants: Variants = {
  enter: { opacity: 0, y: 6, filter: 'blur(3px)' },
  shown: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.24, ease: EASE_OUT },
  },
}

export function TextLoading({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  return (
    <output
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-2 font-mono text-xs text-bone-dim',
        className,
      )}
    >
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="relative flex">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={label}
            initial="enter"
            animate="shown"
            exit="exit"
            variants={wordVariants}
            className="flex whitespace-pre"
          >
            {Array.from(label).map((char, i) => (
              <motion.span
                key={i}
                variants={letterVariants}
                className="inline-block"
              >
                <span
                  className="kokonut-ai-wave inline-block"
                  style={{ animationDelay: `${i * WAVE_STEP}s` }}
                >
                  {char}
                </span>
              </motion.span>
            ))}
          </motion.span>
        </AnimatePresence>
      </span>
    </output>
  )
}
