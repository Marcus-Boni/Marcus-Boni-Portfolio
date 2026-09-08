import { useCallback, useRef, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Markdown textarea with an editing toolbar.
 *
 * Every action goes through `applyEdit`, which rewrites the value and restores
 * a sensible selection afterwards — a toolbar that leaves the caret at the end
 * of the document is worse than no toolbar. `Tab` inserts two spaces instead of
 * leaving the field, which is what you want while writing indented code.
 */

interface MarkdownEditorProps {
  value: string
  onChange: (next: string) => void
  onRequestImage: () => void
  className?: string
}

type Edit =
  /** Wrap the selection, or insert the pair around the caret. */
  | { kind: 'wrap'; before: string; after: string; placeholder: string }
  /** Prefix each selected line. */
  | { kind: 'linePrefix'; prefix: string }
  /** Insert a block at the start of the next free line. */
  | { kind: 'block'; text: string; caretOffset?: number }

const ACTIONS: { label: string; title: string; edit: Edit }[] = [
  { label: 'B', title: 'Negrito (Ctrl+B)', edit: { kind: 'wrap', before: '**', after: '**', placeholder: 'texto' } },
  { label: 'I', title: 'Itálico (Ctrl+I)', edit: { kind: 'wrap', before: '_', after: '_', placeholder: 'texto' } },
  { label: '‹›', title: 'Código inline', edit: { kind: 'wrap', before: '`', after: '`', placeholder: 'code' } },
  { label: 'link', title: 'Link (Ctrl+K)', edit: { kind: 'wrap', before: '[', after: '](https://)', placeholder: 'texto' } },
  { label: 'H2', title: 'Título de seção', edit: { kind: 'linePrefix', prefix: '## ' } },
  { label: 'H3', title: 'Subtítulo', edit: { kind: 'linePrefix', prefix: '### ' } },
  { label: '•', title: 'Lista', edit: { kind: 'linePrefix', prefix: '- ' } },
  { label: '1.', title: 'Lista numerada', edit: { kind: 'linePrefix', prefix: '1. ' } },
  { label: '❝', title: 'Citação', edit: { kind: 'linePrefix', prefix: '> ' } },
  {
    label: 'code',
    title: 'Bloco de código',
    edit: { kind: 'block', text: '```ts title="src/exemplo.ts"\n\n```', caretOffset: 31 },
  },
  {
    label: 'nota',
    title: 'Callout (info / tip / warn / danger)',
    edit: { kind: 'block', text: ':::callout{type=tip}\n\n:::', caretOffset: 21 },
  },
  {
    label: 'quote',
    title: 'Citação em destaque',
    edit: { kind: 'block', text: ':::quote{cite="Fonte"}\n\n:::', caretOffset: 23 },
  },
  {
    label: 'galeria',
    title: 'Galeria de imagens',
    edit: { kind: 'block', text: ':::gallery{columns=2}\n\n:::', caretOffset: 22 },
  },
  {
    label: 'youtube',
    title: 'Vídeo do YouTube',
    edit: { kind: 'block', text: '::youtube{id=VIDEO_ID title="Título"}', caretOffset: 13 },
  },
  {
    label: 'repo',
    title: 'Card de repositório do GitHub',
    edit: {
      kind: 'block',
      text: '::repo{owner=Marcus-Boni name=REPO desc="O que é" lang=TypeScript}',
      caretOffset: 31,
    },
  },
]

export function MarkdownEditor({
  value,
  onChange,
  onRequestImage,
  className,
}: MarkdownEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const applyEdit = useCallback(
    (edit: Edit) => {
      const el = ref.current
      if (!el) return
      const { selectionStart: start, selectionEnd: end } = el
      const selected = value.slice(start, end)

      // Every branch below assigns all three; initialising them here would be
      // dead stores.
      let next: string
      let caretStart: number
      let caretEnd: number

      if (edit.kind === 'wrap') {
        const inner = selected || edit.placeholder
        next = value.slice(0, start) + edit.before + inner + edit.after + value.slice(end)
        caretStart = start + edit.before.length
        caretEnd = caretStart + inner.length
      } else if (edit.kind === 'linePrefix') {
        // Expand the selection to whole lines so a prefix applies per line.
        const lineStart = value.lastIndexOf('\n', start - 1) + 1
        const lineEnd = value.indexOf('\n', end)
        const stop = lineEnd === -1 ? value.length : lineEnd
        const block = value.slice(lineStart, stop)
        const prefixed = block
          .split('\n')
          .map((line) => (line.startsWith(edit.prefix) ? line : edit.prefix + line))
          .join('\n')
        next = value.slice(0, lineStart) + prefixed + value.slice(stop)
        caretStart = lineStart
        caretEnd = lineStart + prefixed.length
      } else {
        // Blocks need their own paragraph — pad with blank lines as needed.
        const before = value.slice(0, start)
        const needsLeading = before.length > 0 && !before.endsWith('\n\n')
        const pad = before.length === 0 ? '' : needsLeading ? '\n\n' : ''
        const insert = pad + edit.text + '\n'
        next = before + insert + value.slice(end)
        caretStart = caretEnd = start + pad.length + (edit.caretOffset ?? edit.text.length)
      }

      onChange(next)
      // The value lands via React state, so the selection has to be restored
      // after the re-render commits.
      requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(caretStart, caretEnd)
      })
    },
    [value, onChange],
  )

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault()
      const el = event.currentTarget
      const { selectionStart: start, selectionEnd: end } = el
      onChange(`${value.slice(0, start)}  ${value.slice(end)}`)
      requestAnimationFrame(() => el.setSelectionRange(start + 2, start + 2))
      return
    }
    if (!(event.ctrlKey || event.metaKey)) return
    const shortcuts: Record<string, Edit> = {
      b: { kind: 'wrap', before: '**', after: '**', placeholder: 'texto' },
      i: { kind: 'wrap', before: '_', after: '_', placeholder: 'texto' },
      k: { kind: 'wrap', before: '[', after: '](https://)', placeholder: 'texto' },
    }
    const edit = shortcuts[event.key.toLowerCase()]
    if (edit) {
      event.preventDefault()
      applyEdit(edit)
    }
  }

  return (
    <div className={cn('flex min-h-0 flex-col border border-line', className)}>
      <div className="flex flex-wrap items-center gap-1 border-b border-line bg-ink-soft/60 px-2 py-2">
        {ACTIONS.map((action) => (
          <ToolButton
            key={action.title}
            title={action.title}
            onClick={() => applyEdit(action.edit)}
          >
            {action.label}
          </ToolButton>
        ))}
        <span aria-hidden className="mx-1 h-4 w-px bg-line" />
        <ToolButton title="Enviar imagem" onClick={onRequestImage}>
          imagem
        </ToolButton>
      </div>

      <textarea
        ref={ref}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        spellCheck
        placeholder="Escreva em Markdown…"
        className="min-h-[28rem] flex-1 resize-none bg-ink px-4 py-4 font-mono text-[13px] leading-relaxed text-bone placeholder:text-smoke focus:outline-none"
      />
    </div>
  )
}

function ToolButton({
  title,
  onClick,
  children,
}: {
  title: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="min-w-7 border border-transparent px-1.5 py-1 font-mono text-[10px] tracking-[0.1em] text-bone-dim uppercase transition-colors hover:border-line hover:text-ember"
    >
      {children}
    </button>
  )
}
