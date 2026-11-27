import type { AgentLens, AgentTurn, RuntimePreference } from './types'

/**
 * Shared in-tab session store so a conversation opened in the home `⌘K` drawer
 * survives seamlessly when expanded into the full `/ask` page (and vice versa).
 *
 * Uses `sessionStorage` so nothing persists past the browser tab, keeping
 * first-party privacy clean.
 */

const STORAGE_KEY = 'mb-agent-session-v1'
const OPEN_EVENT = 'mb:open-agent'

interface StoredSession {
  lens: AgentLens
  runtimePreference: RuntimePreference
  turns: AgentTurn[]
}

const listeners = new Set<() => void>()

function readStorage(): StoredSession {
  if (typeof window === 'undefined') {
    return { lens: 'recruiter', runtimePreference: 'auto', turns: [] }
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { lens: 'recruiter', runtimePreference: 'auto', turns: [] }
    const parsed = JSON.parse(raw) as Partial<StoredSession>
    const lens: AgentLens =
      parsed.lens === 'engineer' || parsed.lens === 'client' ? parsed.lens : 'recruiter'
    const runtimePreference: RuntimePreference =
      parsed.runtimePreference === 'local' ? 'local' : 'auto'
    const turns = Array.isArray(parsed.turns)
      ? parsed.turns.map((turn) => ({ ...turn, streaming: false }))
      : []
    return { lens, runtimePreference, turns }
  } catch {
    return { lens: 'recruiter', runtimePreference: 'auto', turns: [] }
  }
}

let state: StoredSession = readStorage()

function emit() {
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* storage quota full or disabled */
    }
  }
  for (const listener of listeners) listener()
}

export function getAgentSession(): StoredSession {
  return state
}

export function subscribeAgentSession(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setAgentLens(lens: AgentLens): void {
  if (state.lens === lens) return
  state = { ...state, lens }
  emit()
}

export function setRuntimePreference(runtimePreference: RuntimePreference): void {
  if (state.runtimePreference === runtimePreference) return
  state = { ...state, runtimePreference }
  emit()
}

export function setAgentTurns(updater: (prev: AgentTurn[]) => AgentTurn[]): void {
  state = { ...state, turns: updater(state.turns) }
  emit()
}

export function clearAgentSession(): void {
  state = { ...state, turns: [] }
  emit()
}

export interface OpenAgentDetail {
  prompt?: string
  lens?: AgentLens
}

/** Triggers the lazy-loaded `⌘K` drawer from anywhere on the home page. */
export function openAgentDrawer(detail?: OpenAgentDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<OpenAgentDetail>(OPEN_EVENT, { detail }))
}

export function onOpenAgentDrawer(handler: (detail?: OpenAgentDetail) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const wrapped = (event: Event) => {
    handler((event as CustomEvent<OpenAgentDetail>).detail)
  }
  window.addEventListener(OPEN_EVENT, wrapped)
  return () => window.removeEventListener(OPEN_EVENT, wrapped)
}
