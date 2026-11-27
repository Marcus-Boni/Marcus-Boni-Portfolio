import type { AgentLens } from '@/agent/types'

export const OPEN_AGENT_EVENT = 'mb:open-agent'

export interface OpenAgentDetail {
  prompt?: string
  lens?: AgentLens
}

/** Triggers the lazy-loaded `⌘K` dossier drawer without importing `src/agent/*`. */
export function triggerAgentDrawer(detail?: OpenAgentDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<OpenAgentDetail>(OPEN_AGENT_EVENT, { detail }))
}
