import { gsap } from '@/animations/gsap'
import { useGsapScope } from '@/hooks/useScrollReveal'
import { cn } from '@/lib/utils'

interface SectionHeadingProps {
  number: string
  label: string
  className?: string
}

/** Editorial section marker: mono index + tracked label over a hairline. */
export function SectionHeading({ number, label, className }: SectionHeadingProps) {
  const scopeRef = useGsapScope<HTMLDivElement>(({ root }) => {
    gsap.from(root.children, {
      opacity: 0,
      y: 16,
      duration: 0.8,
      stagger: 0.1,
      scrollTrigger: { trigger: root, start: 'top 88%', once: true },
    })
  })

  return (
    <div
      ref={scopeRef}
      className={cn(
        'flex items-baseline gap-4 border-t border-line pt-4 font-mono text-[11px] tracking-[0.3em] uppercase',
        className,
      )}
    >
      <span className="text-ember">{number}</span>
      <span className="text-smoke">{label}</span>
    </div>
  )
}
