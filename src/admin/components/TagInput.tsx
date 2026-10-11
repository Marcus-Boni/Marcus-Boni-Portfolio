import { useState } from 'react'

import { focusRing } from '@/admin/components/ui'
import { cn } from '@/lib/utils'

/**
 * Chip input for the lists that were comma-separated strings.
 *
 * `stack.join(', ')` in a text field looks harmless until you delete a comma by
 * accident and three technologies merge into one. Chips make each value a thing
 * you can see and remove, and Enter / comma / blur all commit — the three
 * gestures people actually try.
 */
export function TagInput({
  values,
  onChange,
  placeholder = 'Digite e pressione Enter',
  /** Optional list offered as one-click additions (recent or suggested values). */
  suggestions = [],
  transform,
}: {
  values: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  suggestions?: string[]
  /** Normalises a value before it is added (lowercasing tags, say). */
  transform?: (value: string) => string
}) {
  const [input, setInput] = useState('')

  const add = (raw: string) => {
    const value = (transform ? transform(raw) : raw).trim().replace(/,$/, '')
    if (!value) {
      setInput('')
      return
    }
    if (!values.some((existing) => existing.toLowerCase() === value.toLowerCase())) {
      onChange([...values, value])
    }
    setInput('')
  }

  const remaining = suggestions.filter(
    (suggestion) =>
      !values.some((value) => value.toLowerCase() === suggestion.toLowerCase()),
  )

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border border-line bg-ink px-3 py-2 focus-within:border-ember">
        {values.map((value) => (
          <span
            key={value}
            className="inline-flex items-center gap-1.5 border border-line px-2 py-0.5 font-mono text-[10px] tracking-[0.14em] text-bone-dim uppercase"
          >
            {value}
            <button
              type="button"
              onClick={() => onChange(values.filter((item) => item !== value))}
              aria-label={`Remover ${value}`}
              className={cn('text-smoke transition-colors hover:text-ember', focusRing)}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault()
              add(input)
            } else if (event.key === 'Backspace' && !input && values.length) {
              onChange(values.slice(0, -1))
            }
          }}
          onBlur={() => add(input)}
          placeholder={values.length ? '' : placeholder}
          className="min-w-32 flex-1 bg-transparent text-sm text-bone placeholder:text-smoke/70 focus:outline-none"
        />
      </div>

      {remaining.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[9px] tracking-[0.16em] text-smoke/70 uppercase">
            sugestões
          </span>
          {remaining.slice(0, 8).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => add(suggestion)}
              className={cn(
                'border border-line px-1.5 py-0.5 font-mono text-[9px] tracking-[0.14em] text-smoke uppercase transition-colors hover:border-ember hover:text-ember',
                focusRing,
              )}
            >
              + {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
