import { useState, type DragEvent, type HTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

/**
 * Drag-to-reorder for the editor lists.
 *
 * Two rules make native HTML5 drag behave inside a form. First, the row is only
 * `draggable` while the handle is held — otherwise every text selection inside
 * an expanded card starts a drag instead. Second, the ↑/↓ buttons stay: drag is
 * the fast path, keys are the accessible one, and reordering by keyboard is the
 * only option on a touch device where dragging a tall card is misery.
 */

/** Props for the grab handle — spread onto `<DragHandle>`. */
export interface HandleProps {
  onMouseDown: () => void
  onMouseUp: () => void
  onTouchStart: () => void
  onTouchEnd: () => void
}

export function useSortable(onMove: (from: number, to: number) => void) {
  const [armed, setArmed] = useState<number | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const finish = () => {
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      onMove(dragIndex, overIndex)
    }
    setArmed(null)
    setDragIndex(null)
    setOverIndex(null)
  }

  /** Spread on the list item. */
  const rowProps = (
    index: number,
  ): HTMLAttributes<HTMLElement> & { draggable: boolean } => ({
    draggable: armed === index,
    onDragStart: (event: DragEvent) => {
      setDragIndex(index)
      event.dataTransfer.effectAllowed = 'move'
      // Firefox refuses to start a drag with nothing on the transfer.
      event.dataTransfer.setData('text/plain', String(index))
    },
    onDragOver: (event: DragEvent) => {
      if (dragIndex === null) return
      event.preventDefault()
      setOverIndex(index)
    },
    onDrop: (event: DragEvent) => {
      event.preventDefault()
      finish()
    },
    onDragEnd: finish,
  })

  /** Spread on the grab handle. */
  const handleProps = (index: number): HandleProps => ({
    onMouseDown: () => setArmed(index),
    onMouseUp: () => setArmed(null),
    onTouchStart: () => setArmed(index),
    onTouchEnd: () => setArmed(null),
  })

  return {
    rowProps,
    handleProps,
    dragIndex,
    overIndex,
    /**
     * Classes for the row being dragged, and for the one it is hovering over.
     * The drop target is an outline rather than a border: these rows wrap cards
     * that draw their own border, and a border here would either double up or
     * be invisible under the child's.
     */
    rowClass: (index: number) =>
      cn(
        dragIndex === index && 'opacity-40',
        overIndex === index &&
          dragIndex !== index &&
          'outline-2 outline-offset-2 outline-ember/70',
      ),
  }
}
