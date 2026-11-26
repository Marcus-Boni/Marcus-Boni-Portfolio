import {
  prepareGroundedTurn,
  runPlannedTools,
  streamTextLocally,
} from './runtime'
import type {
  AgentEvent,
  AgentRuntime,
  AgentRuntimeContext,
  Citation,
  EdgeCapability,
  RuntimeMeta,
} from './types'

/**
 * Phase 2 Hybrid Edge LLM + Deterministic Grounding runtime.
 *
 * 1. Always executes deterministic tools against Marcus's real portfolio & CMS
 *    data so tool traces, citations, `/fit` ledgers, and approval cards stay
 *    100% verifiable.
 * 2. When `preference === 'auto'` and `/agent/v1/chat` is configured on
 *    Netlify Edge, streams live LLM synthesis over SSE grounded strictly in the
 *    retrieved evidence, sanitizing any unverified citation brackets in real time.
 * 3. When running locally (`pnpm dev` without Netlify CLI), when no LLM API key
 *    is configured (`503`), when rate-limited (`429`), or on timeout/network
 *    error, degrades silently to the local deterministic composition in the
 *    same turn with zero error flash.
 */

const EDGE_CHAT_ENDPOINT = '/agent/v1/chat'
const PROBE_TIMEOUT_MS = 2_500
const CONNECT_TIMEOUT_MS = 11_000

const CITATION_BRACKET_RE = /\[(\d{1,2}|EXP·\d{2}|POST·\d{2}|DOC·\d{2})\]/g
const REFINEMENT_FOLLOW_UP_RE =
  /\b(resum[aeo]|sintetiz[ae]|simplifi|detalh[ae]|explique|compare|comparar|traduz|em \d+ (?:bullet|linha|ponto|topic)|curto|curtos|objetivo|para um cto|para o cto|para recrutador|summarize|summary|shorten|bullet|bullets|tl;?dr|translate|simplify|elaborate|compare)\b/i

let cachedCapability: EdgeCapability | null = null

export function resetEdgeCapabilityCache(): void {
  cachedCapability = null
}

/**
 * Strips any `[ID]` citation marker that does not belong to the current turn's
 * verified citation list so an LLM can never emit a dangling citation chip.
 */
export function sanitizeCitationMarkers(text: string, allowedIds: Set<string>): string {
  return text
    .replace(CITATION_BRACKET_RE, (full, id: string) => (allowedIds.has(id) ? full : ''))
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
}

/**
 * Non-blocking capability probe against `GET /agent/v1/chat` to discover
 * whether a server-side LLM provider is configured on the current deployment.
 */
export async function probeEdgeCapability(
  fetchImpl: typeof fetch = fetch,
  endpoint = EDGE_CHAT_ENDPOINT,
): Promise<EdgeCapability> {
  if (cachedCapability) return cachedCapability

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)

  try {
    const response = await fetchImpl(endpoint, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
    clearTimeout(timer)

    const contentType = response.headers.get('content-type') ?? ''
    if (!response.ok || !contentType.includes('application/json')) {
      cachedCapability = {
        checked: true,
        configured: false,
        provider: null,
        model: null,
      }
      return cachedCapability
    }

    const data = (await response.json()) as {
      configured?: boolean
      provider?: string | null
      model?: string | null
    }
    cachedCapability = {
      checked: true,
      configured: Boolean(data.configured),
      provider: typeof data.provider === 'string' ? data.provider : null,
      model: typeof data.model === 'string' ? data.model : null,
    }
    return cachedCapability
  } catch {
    clearTimeout(timer)
    cachedCapability = {
      checked: true,
      configured: false,
      provider: null,
      model: null,
    }
    return cachedCapability
  }
}

interface StreamSseOutcome {
  streamed: boolean
  fallbackReason?: RuntimeMeta['fallbackReason']
  provider?: string
  model?: string
}

/**
 * Buffers trailing partial `[...` tokens across SSE chunks so citation
 * sanitization works reliably even when an LLM splits `[EXP·01]` across chunks.
 */
function createCitationStreamSanitizer(allowedIds: Set<string>) {
  let pending = ''

  const push = (chunk: string): string => {
    const combined = pending + chunk
    const openIdx = combined.lastIndexOf('[')
    const closeIdx = combined.lastIndexOf(']')
    if (openIdx > closeIdx && combined.length - openIdx <= 12) {
      pending = combined.slice(openIdx)
      return sanitizeCitationMarkers(combined.slice(0, openIdx), allowedIds)
    }
    pending = ''
    return sanitizeCitationMarkers(combined, allowedIds)
  }

  const flush = (): string => {
    if (!pending) return ''
    const out = sanitizeCitationMarkers(pending, allowedIds)
    pending = ''
    return out
  }

  return { push, flush }
}

function buildEvidencePayload(citations: Citation[]) {
  return citations.slice(0, 12).map((item) => ({
    id: item.id,
    kind: item.kind,
    title: item.title,
    subtitle: item.subtitle,
    excerpt: item.excerpt,
    href: item.href,
  }))
}

export class HybridEdgeRuntime implements AgentRuntime {
  readonly id = 'signal-dossier-hybrid-v2'
  readonly mode = 'hybrid' as const

  private readonly endpoint: string
  private readonly fetchImpl?: typeof fetch
  private readonly connectTimeoutMs: number

  constructor(options?: {
    endpoint?: string
    fetchImpl?: typeof fetch
    connectTimeoutMs?: number
  }) {
    this.endpoint = options?.endpoint ?? EDGE_CHAT_ENDPOINT
    this.fetchImpl = options?.fetchImpl
    this.connectTimeoutMs = options?.connectTimeoutMs ?? CONNECT_TIMEOUT_MS
  }

  async *streamTurn(
    input: string,
    context: AgentRuntimeContext,
  ): AsyncGenerator<AgentEvent, void, void> {
    const { locale, lens, history, preference = 'auto', reducedMotion, instant, signal } = context
    const isPt = locale === 'pt'
    const fast = Boolean(reducedMotion || instant)

    const plan = prepareGroundedTurn(input, context)

    // Carry forward verified citations on conversational refinement follow-ups
    // ("summarize in 2 bullets", "resuma para um CTO") so Edge LLM keeps live
    // clickable source chips instead of firing an out-of-scope handoff card.
    const prevAssistantWithCitations = [...(history ?? [])]
      .reverse()
      .find((entry) => entry.role === 'assistant' && (entry.citations?.length ?? 0) > 0)
    const isRefinementFollowUp =
      Boolean(prevAssistantWithCitations) &&
      (plan.intent === 'out_of_scope' || plan.intent === 'general') &&
      REFINEMENT_FOLLOW_UP_RE.test(input)

    const effectiveCitations = isRefinementFollowUp
      ? prevAssistantWithCitations?.citations ?? plan.composed.citations
      : plan.composed.citations

    // 1. Run deterministic tools first (always verifiable, millisecond-fast)
    if (!isRefinementFollowUp) {
      yield* runPlannedTools(plan.plannedTools, locale, fast, signal)
      if (signal?.aborted) return
    }

    if (effectiveCitations.length > 0) {
      yield { type: 'citations', citations: effectiveCitations }
    }

    // Pure transactional commands (/cv) need zero LLM round-trip
    const skipEdgeForIntent = plan.intent === 'cv'
    const knownUnconfigured =
      cachedCapability?.checked === true && !cachedCapability.configured

    let edgeOutcome: StreamSseOutcome = {
      streamed: false,
      fallbackReason:
        preference === 'local'
          ? 'manual'
          : knownUnconfigured
            ? 'unconfigured'
            : undefined,
    }

    if (preference === 'auto' && !skipEdgeForIntent && !knownUnconfigured) {
      yield {
        type: 'status',
        label: isPt
          ? 'Sintetizando com Edge LLM sobre evidências…'
          : 'Synthesizing grounded answer via Edge LLM…',
      }

      const allowedIds = new Set(effectiveCitations.map((item) => item.id))
      const sanitizer = createCitationStreamSanitizer(allowedIds)
      const requestBody = {
        prompt: input.trim().slice(0, 4000),
        locale,
        lens,
        intent: isRefinementFollowUp ? 'followup' : plan.intent,
        history: (history ?? []).slice(-6).map((item) => ({
          role: item.role,
          text: item.text.slice(0, 1200),
        })),
        evidence: buildEvidencePayload(effectiveCitations),
        fitSummary: plan.composed.fitReport
          ? {
              roleHint: plan.composed.fitReport.roleHint,
              matched: plan.composed.fitReport.matched.map((item) => item.skill),
              gaps: plan.composed.fitReport.gaps,
            }
          : undefined,
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.connectTimeoutMs)
      const onOuterAbort = () => controller.abort()
      signal?.addEventListener('abort', onOuterAbort, { once: true })

      try {
        const doFetch = this.fetchImpl ?? globalThis.fetch.bind(globalThis)
        const response = await doFetch(this.endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'text/event-stream',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        const contentType = response.headers.get('content-type') ?? ''

        if (response.ok && response.body && contentType.includes('text/event-stream')) {
          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''
          let emittedAny = false
          let provider: string | undefined
          let model: string | undefined
          let metaEmitted = false

          try {
            while (true) {
              if (signal?.aborted) {
                void reader.cancel()
                return
              }
              const { done, value } = await reader.read()
              if (done) break
              buffer += decoder.decode(value, { stream: true })
              const frames = buffer.split(/\r?\n\r?\n/)
              buffer = frames.pop() ?? ''

              for (const frame of frames) {
                let eventName = 'message'
                const dataLines: string[] = []
                for (const line of frame.split(/\r?\n/)) {
                  if (line.startsWith('event:')) eventName = line.slice(6).trim()
                  else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
                }
                if (dataLines.length === 0) continue

                let parsed: Record<string, unknown>
                try {
                  parsed = JSON.parse(dataLines.join('\n')) as Record<string, unknown>
                } catch {
                  continue
                }

                if (eventName === 'meta') {
                  provider = typeof parsed.provider === 'string' ? parsed.provider : undefined
                  model = typeof parsed.model === 'string' ? parsed.model : undefined
                  cachedCapability = {
                    checked: true,
                    configured: true,
                    provider: provider ?? null,
                    model: model ?? null,
                  }
                  if (!metaEmitted) {
                    metaEmitted = true
                    yield {
                      type: 'runtime_meta',
                      meta: { mode: 'edge-llm', provider, model },
                    }
                  }
                } else if (eventName === 'delta' && typeof parsed.delta === 'string') {
                  const clean = sanitizer.push(parsed.delta)
                  if (clean) {
                    if (!metaEmitted) {
                      metaEmitted = true
                      yield {
                        type: 'runtime_meta',
                        meta: { mode: 'edge-llm', provider, model },
                      }
                    }
                    emittedAny = true
                    yield { type: 'text_delta', delta: clean }
                  }
                }
              }
            }

            const tail = sanitizer.flush()
            if (tail) {
              emittedAny = true
              yield { type: 'text_delta', delta: tail }
            }

            if (emittedAny) {
              edgeOutcome = { streamed: true, provider, model }
            } else {
              edgeOutcome = { streamed: false, fallbackReason: 'offline' }
            }
          } finally {
            reader.releaseLock()
          }
        } else if (response.status === 503 || response.status === 404) {
          cachedCapability = {
            checked: true,
            configured: false,
            provider: null,
            model: null,
          }
          edgeOutcome = { streamed: false, fallbackReason: 'unconfigured' }
        } else if (response.status === 429) {
          edgeOutcome = { streamed: false, fallbackReason: 'rate_limited' }
        } else {
          edgeOutcome = { streamed: false, fallbackReason: 'offline' }
        }
      } catch {
        clearTimeout(timeoutId)
        if (signal?.aborted) return
        edgeOutcome = { streamed: false, fallbackReason: 'offline' }
      } finally {
        signal?.removeEventListener('abort', onOuterAbort)
      }
    }

    if (signal?.aborted) return

    // 2. Seamless local deterministic fallback whenever Edge LLM wasn't used
    if (!edgeOutcome.streamed) {
      yield {
        type: 'status',
        label: isPt ? 'Verificando citações e evidências…' : 'Grounding citations & evidence…',
      }
      yield {
        type: 'runtime_meta',
        meta: {
          mode: 'local-deterministic',
          fallbackReason: edgeOutcome.fallbackReason,
        },
      }
      yield* streamTextLocally(plan.composed.text, fast, signal)
      if (signal?.aborted) return
    }

    if (plan.composed.fitReport) {
      yield { type: 'fit_report', report: plan.composed.fitReport }
    }

    if (plan.composed.approval && !(edgeOutcome.streamed && isRefinementFollowUp)) {
      yield { type: 'approval_request', approval: plan.composed.approval }
    }

    yield { type: 'done', intent: plan.intent }
  }
}

export const defaultHybridRuntime = new HybridEdgeRuntime()
