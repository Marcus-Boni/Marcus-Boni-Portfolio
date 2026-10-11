import { IconButton } from '@/admin/components/ui'
import type { HandleProps } from '@/admin/lib/use-sortable'

/** The grab handle — same affordance in every reorderable list. */
export function DragHandle(props: HandleProps) {
  return (
    <span
      {...props}
      title="Arraste para reordenar"
      aria-hidden
      className="inline-flex size-7 cursor-grab items-center justify-center font-mono text-xs text-smoke transition-colors select-none hover:text-bone active:cursor-grabbing"
    >
      ⠿
    </span>
  )
}

/** ↑ / ↓ pair: the keyboard-accessible half of reordering. */
export function MoveButtons({
  index,
  total,
  onMove,
}: {
  index: number
  total: number
  onMove: (from: number, to: number) => void
}) {
  return (
    <>
      <IconButton
        size="sm"
        label="Mover para cima"
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
      >
        ↑
      </IconButton>
      <IconButton
        size="sm"
        label="Mover para baixo"
        disabled={index === total - 1}
        onClick={() => onMove(index, index + 1)}
      >
        ↓
      </IconButton>
    </>
  )
}
