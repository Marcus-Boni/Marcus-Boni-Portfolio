import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { BodyContext, StageContext, useBodyLabels } from '@/blog/lib/body-context'
import { parseLineRanges } from '@/blog/lib/code-meta'

/**
 * A walkthrough: something stays pinned (a code block, an image) while the
 * steps that explain it scroll past, each one lighting the lines it is about.
 *
 * The Markdown is regrouped by `remarkBlogDirectives` into a stage and a list
 * of steps, and summarised as a `plan` — for every step, which pane it shows
 * and which lines it marks. These components only follow that plan: the step
 * crossing the reading band becomes the current one, and the stage reacts.
 *
 * Beside the text on a wide page, pinned above it on a narrow one.
 */

interface Walkthrough {
  current: number
  setCurrent: React.Dispatch<React.SetStateAction<number>>
  plan: { pane: number; lines: Set<number> }[]
}

const WalkthroughContext = createContext<Walkthrough | null>(null)
const NO_LINES = new Set<number>()

export function Steps({ plan, children }: { plan?: string; children?: ReactNode }) {
  const environment = useContext(BodyContext)
  const [current, setCurrent] = useState(0)

  const parsed = useMemo(
    () =>
      (plan ?? '')
        .split('|')
        .filter(Boolean)
        .map((part) => {
          const colon = part.indexOf(':')
          return {
            pane: Number(part.slice(0, colon)) || 0,
            lines: parseLineRanges(part.slice(colon + 1)),
          }
        }),
    [plan],
  )
  const walkthrough = useMemo(() => ({ current, setCurrent, plan: parsed }), [current, parsed])
  // Notes inside a walkthrough fold under their sentence: the margin they
  // would float into is where the stage sits.
  const inside = useMemo(() => ({ ...environment, margin: false }), [environment])

  return (
    <WalkthroughContext value={walkthrough}>
      <BodyContext value={inside}>
        <div className="steps" data-wide={environment.margin || undefined}>
          {children}
        </div>
      </BodyContext>
    </WalkthroughContext>
  )
}

export function StepsStage({ children }: { children?: ReactNode }) {
  return <div className="steps-stage">{children}</div>
}

export function StepsPane({ index, children }: { index?: string; children?: ReactNode }) {
  const walkthrough = useContext(WalkthroughContext)
  const step = walkthrough?.plan[walkthrough.current]
  const shown = !step || step.pane === Number(index)

  return (
    <div className="steps-pane" data-shown={shown || undefined} inert={!shown}>
      <StageContext value={step ? (shown ? step.lines : NO_LINES) : null}>
        {children}
      </StageContext>
    </div>
  )
}

export function StepsNotes({ children }: { children?: ReactNode }) {
  return <ol className="steps-notes">{children}</ol>
}

export function Step({
  index,
  lines,
  children,
}: {
  index?: string
  lines?: string
  children?: ReactNode
}) {
  const walkthrough = useContext(WalkthroughContext)
  const labels = useBodyLabels()
  const ref = useRef<HTMLLIElement>(null)
  const at = Number(index) || 0
  const setCurrent = walkthrough?.setCurrent

  useEffect(() => {
    const element = ref.current
    if (!element || !setCurrent) return
    // The line a step crosses to become the current one: mid-screen when the
    // stage is beside the text, lower down when the stage is pinned above it.
    // The root reaches far above the viewport, so a step counts as crossed for
    // as long as it is above the line. The current step is the last one
    // crossed, which also holds when the page jumps over the walkthrough.
    const beside =
      element.closest('.steps')?.hasAttribute('data-wide') &&
      window.matchMedia('(min-width: 64rem)').matches
    const observer = new IntersectionObserver(
      ([entry]) => {
        setCurrent((current) =>
          entry.isIntersecting
            ? Math.max(current, at)
            : current >= at
              ? Math.max(0, at - 1)
              : current,
        )
      },
      { rootMargin: `100000px 0px ${beside ? '-50%' : '-28%'} 0px` },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [at, setCurrent])

  // A `:::step` written outside `::::steps` is just a block of prose.
  if (!walkthrough) return <div>{children}</div>

  const isCurrent = walkthrough.current === at
  return (
    <li
      ref={ref}
      className="step"
      data-current={isCurrent || undefined}
      aria-current={isCurrent ? 'step' : undefined}
    >
      <p className="step-meta">
        <span>{labels.step(at + 1, walkthrough.plan.length)}</span>
        {lines && <span>{labels.lines(lines)}</span>}
      </p>
      <div className="step-body">{children}</div>
    </li>
  )
}
