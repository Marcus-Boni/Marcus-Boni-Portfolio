/**
 * How far the reader got in each entry, kept in their own browser.
 *
 * Nothing here is sent anywhere: it exists so a returning reader can pick an
 * entry up where they left it, and so the index can tell them which entries
 * they have already read.
 */

const KEY = 'mb-journal-reading'
/** Entries remembered before the oldest are dropped. */
const KEEP = 60
/** From this point on an entry counts as read, and stays read. */
const DONE = 92

type Memory = Record<string, { p: number; at: number }>

let memory: Memory | null = null

function load(): Memory {
  if (memory) return memory
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    memory = stored && typeof stored === 'object' ? (stored as Memory) : {}
  } catch {
    // No storage (private mode, a test, a server render): remember for this visit only.
    memory = {}
  }
  return memory
}

/** 0–100 for an entry; 100 once it was read to the end. */
export function readingProgress(slug: string): number {
  return load()[slug]?.p ?? 0
}

export function rememberProgress(slug: string, percent: number): void {
  const all = load()
  const before = all[slug]?.p ?? 0
  const p = before === 100 || percent >= DONE ? 100 : percent
  if (p === before) return

  all[slug] = { p, at: Date.now() }
  const slugs = Object.keys(all)
  if (slugs.length > KEEP) {
    slugs
      .sort((a, b) => all[a].at - all[b].at)
      .slice(0, slugs.length - KEEP)
      .forEach((old) => delete all[old])
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* storage full or blocked — the mark just does not outlive the visit */
  }
}
