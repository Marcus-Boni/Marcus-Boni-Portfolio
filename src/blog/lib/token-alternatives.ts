/**
 * Pure parser for the `:::ai-tokens` blog directive (Kokonut `AI-20 Token
 * Alternatives` ported to Signal & Ink).
 *
 * Authoring syntax (one token or phrase per line):
 *
 *   :::ai-tokens{prompt="O servidor MCP expõe"}
 *   16 ferramentas (74% | 12 endpoints:14% | 8 recursos:8% | uma API:4%)
 *   para agentes (82% | a clientes:11% | via HTTP:7%)
 *   :::
 *
 * Each line with `(pct% | alt:pct% | ...)` becomes an interactive token whose
 * top-k probability distribution readers can inspect and swap live. Plain lines
 * without parentheses render as static context tokens.
 */

export interface TokenCandidate {
  text: string
  prob: number
}

export interface TokenSlot {
  chosen: TokenCandidate
  alternatives: TokenCandidate[]
}

const SLOT_LINE_RE = /^(.+?)\s*\(([^()]+)\)\s*$/

function parseProb(raw: string): number {
  const num = Number.parseFloat(raw.replace('%', '').trim())
  if (!Number.isFinite(num) || num < 0) return 0
  return Math.min(100, Math.round(num * 10) / 10)
}

export function parseTokenAlternatives(spec: string): TokenSlot[] {
  const lines = spec
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const slots: TokenSlot[] = []

  for (const line of lines) {
    const match = line.match(SLOT_LINE_RE)
    if (!match) {
      slots.push({
        chosen: { text: line, prob: 100 },
        alternatives: [],
      })
      continue
    }

    const chosenText = match[1].trim()
    const parts = match[2]
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean)

    if (!chosenText || parts.length === 0) continue

    const chosenProb = parseProb(parts[0])
    const alternatives: TokenCandidate[] = []

    for (const part of parts.slice(1)) {
      const colonIdx = part.lastIndexOf(':')
      if (colonIdx <= 0) continue
      const altText = part.slice(0, colonIdx).trim()
      const altProb = parseProb(part.slice(colonIdx + 1))
      if (!altText) continue
      alternatives.push({ text: altText, prob: altProb })
    }

    slots.push({
      chosen: { text: chosenText, prob: chosenProb },
      alternatives,
    })
  }

  return slots
}
