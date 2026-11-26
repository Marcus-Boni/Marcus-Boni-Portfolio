import type { PostMeta } from '@/blog/types'
import type { SiteContent } from '@/content/types'
import type { Locale } from '@/i18n/translations'

/**
 * Core protocol for the portfolio's agentic dossier console.
 *
 * The UI never talks directly to the retrieval engine — it only consumes the
 * `AgentEvent` stream produced by an `AgentRuntime`. Phase 1 ships a local,
 * zero-cost deterministic runtime; Phase 2 can swap in an edge LLM adapter
 * emitting the exact same events and tool payloads without touching the UI.
 */

export type AgentLens = 'recruiter' | 'engineer' | 'client'

export type AgentIntent =
  | 'fit'
  | 'stack'
  | 'projects'
  | 'experience'
  | 'posts'
  | 'profile'
  | 'ai_work'
  | 'availability'
  | 'contact'
  | 'cv'
  | 'api'
  | 'out_of_scope'
  | 'general'

export type ToolName =
  | 'getProfile'
  | 'listTechnologies'
  | 'getExperience'
  | 'listProjects'
  | 'listPosts'
  | 'matchRole'
  | 'prepareHandoff'

export type ToolStatus = 'running' | 'done' | 'error'

export interface ToolCallTrace {
  id: string
  name: ToolName
  endpoint: string
  label: string
  args: Record<string, unknown>
  status: ToolStatus
  startedAt: number
  durationMs?: number
  summary?: string
  result?: unknown
}

export type CitationKind = 'project' | 'experience' | 'stack' | 'post' | 'profile' | 'api'

export interface Citation {
  /** Short editorial marker printed inline, e.g. `01`, `EXP·04`, `POST`. */
  id: string
  kind: CitationKind
  title: string
  subtitle: string
  excerpt: string
  /** External URL, internal route, or home section hash (`/#work`). */
  href: string
  external?: boolean
  meta?: string
}

export interface FitEvidenceItem {
  skill: string
  category?: 'frontend' | 'backend' | 'data' | 'ops' | 'domain'
  proofs: {
    label: string
    kind: 'project' | 'experience' | 'stack'
    detail: string
    href: string
    external?: boolean
  }[]
}

export interface FitGapItem {
  term: string
  adjacent: string[]
}

export interface FitReport {
  roleHint?: string
  matched: FitEvidenceItem[]
  gaps: FitGapItem[]
  relevantProjects: {
    index: string
    title: string
    url: string
    matchedTerms: string[]
    summary: string
  }[]
  relevantEngagements: {
    id: string
    client: string
    title: string
    sector: string
    matchedTerms: string[]
    scope: string
  }[]
  markdownBrief: string
}

export type ApprovalKind = 'send_message' | 'download_cv'

export interface ApprovalAction {
  id: string
  kind: ApprovalKind
  title: string
  description: string
  status: 'pending' | 'approved' | 'dismissed' | 'error'
  /** Pre-filled fields for `send_message`. */
  draft?: {
    subject: string
    message: string
  }
  /** Pre-selected locale file for `download_cv`. */
  cvLocale?: Locale
  statusNote?: string
}

export interface AgentTurn {
  id: string
  role: 'user' | 'assistant'
  text: string
  lens: AgentLens
  locale: Locale
  intent?: AgentIntent
  statusLabel?: string
  tools: ToolCallTrace[]
  citations: Citation[]
  fitReport?: FitReport
  approval?: ApprovalAction
  streaming?: boolean
  stopped?: boolean
  createdAt: number
}

export interface SlashCommandDef {
  command: string
  label: Record<Locale, string>
  description: Record<Locale, string>
  template: Record<Locale, string>
}

export type AgentEvent =
  | { type: 'status'; label: string }
  | { type: 'tool_start'; tool: ToolCallTrace }
  | {
      type: 'tool_result'
      id: string
      durationMs: number
      summary: string
      result: unknown
    }
  | { type: 'text_delta'; delta: string }
  | { type: 'citations'; citations: Citation[] }
  | { type: 'fit_report'; report: FitReport }
  | { type: 'approval_request'; approval: ApprovalAction }
  | { type: 'done'; intent: AgentIntent }
  | { type: 'error'; message: string }

export interface AgentRuntimeContext {
  content: SiteContent
  posts: PostMeta[]
  locale: Locale
  lens: AgentLens
  reducedMotion?: boolean
  /** Disables simulated token pacing (used by the Vitest eval suite). */
  instant?: boolean
  signal?: AbortSignal
}

export interface AgentRuntime {
  readonly id: string
  readonly mode: 'local-deterministic' | 'edge-llm'
  streamTurn(
    input: string,
    context: AgentRuntimeContext,
  ): AsyncGenerator<AgentEvent, void, void>
}
