import { describe, expect, it } from 'vitest'

import {
  eventsToCsv,
  summarize,
  type AnalyticsEvent,
} from '@/admin/services/analytics'
import {
  buildBlogAskPath,
  buildShareableAskPath,
  buildShareableAskUrl,
  parseAskQueryParams,
  slugifyBriefFilename,
} from '@/agent/share'

describe('Phase 3 — deep-link & shareable brief utilities', () => {
  it('parses valid query params and safely ignores invalid lens/mode values', () => {
    expect(parseAskQueryParams('?lens=engineer&mode=local&q=Rust+e+MCP')).toEqual({
      lens: 'engineer',
      mode: 'local',
      prompt: 'Rust e MCP',
    })

    expect(parseAskQueryParams('lens=hacker&mode=evil&q=   ')).toEqual({
      lens: undefined,
      mode: undefined,
      prompt: undefined,
    })

    const longPrompt = 'x'.repeat(2_500)
    expect(parseAskQueryParams(`?q=${longPrompt}`).prompt?.length).toBe(2_000)
  })

  it('round-trips bilingual shareable /ask and /en/ask URLs cleanly', () => {
    const ptUrl = buildShareableAskUrl({
      origin: 'https://marcusboni.com.br',
      locale: 'pt',
      lens: 'recruiter',
      prompt: '/fit Senior Full-Stack TypeScript PostgreSQL',
    })
    expect(ptUrl).toContain('https://marcusboni.com.br/ask?')
    const parsedPt = parseAskQueryParams(new URL(ptUrl).search)
    expect(parsedPt).toEqual({
      lens: 'recruiter',
      mode: undefined,
      prompt: '/fit Senior Full-Stack TypeScript PostgreSQL',
    })

    const enPath = buildShareableAskPath({
      locale: 'en',
      lens: 'client',
      prompt: 'Enterprise ERP integrations',
    })
    expect(enPath.startsWith('/en/ask?')).toBe(true)
  })

  it('builds contextual blog post deep-links in PT and EN targeting the engineer lens', () => {
    const ptPath = buildBlogAskPath({
      locale: 'pt',
      title: 'Avaliação de busca em RAG',
      tags: ['IA', 'RAG', 'pgvector'],
    })
    expect(ptPath.startsWith('/ask?')).toBe(true)
    const parsedPt = parseAskQueryParams(ptPath.split('?')[1] ?? '')
    expect(parsedPt.lens).toBe('engineer')
    expect(parsedPt.prompt).toContain('Avaliação de busca em RAG')
    expect(parsedPt.prompt).toContain('pgvector')

    const enPath = buildBlogAskPath({
      locale: 'en',
      title: 'Edge Markdown Negotiation',
      tags: ['HTTP', 'Edge'],
    })
    expect(enPath.startsWith('/en/ask?')).toBe(true)
    const parsedEn = parseAskQueryParams(enPath.split('?')[1] ?? '')
    expect(parsedEn.prompt).toContain('Edge Markdown Negotiation')
  })

  it('slugifies role hints into safe Markdown filenames', () => {
    expect(slugifyBriefFilename('Engenheiro Full-Stack Sênior (IA & Dados)')).toBe(
      'marcus-boni-fit-engenheiro-full-stack-senior-ia-dados.md',
    )
    expect(slugifyBriefFilename(undefined)).toBe('marcus-boni-fit-brief.md')
  })
})

describe('Phase 3 — Admin Dossier Intelligence aggregation', () => {
  const now = new Date('2026-11-26T15:00:00.000Z')
  const withinCurrent = new Date('2026-11-25T14:00:00.000Z')
  const withinPrevious = new Date('2026-11-10T14:00:00.000Z')

  function makeEvent(overrides: Partial<AnalyticsEvent>): AnalyticsEvent {
    return {
      id: `evt-${Math.random().toString(36).slice(2, 7)}`,
      type: 'pageview',
      path: '/ask',
      visitorId: 'v-1',
      sessionId: 's-1',
      isNewVisitor: true,
      device: 'desktop',
      browser: 'Chrome',
      os: 'Windows',
      referrerHost: 'linkedin.com',
      country: 'Brazil',
      language: 'pt-BR',
      createdAt: withinCurrent,
      ...overrides,
    }
  }

  it('aggregates dossier opens, queries, /fit averages, providers, lenses, and counts agent activity as engagement', () => {
    const events: AnalyticsEvent[] = [
      // Current window — session s-1 lands on /ask and runs a /fit query (must NOT bounce!)
      makeEvent({ type: 'pageview', sessionId: 's-1' }),
      makeEvent({ type: 'agent_open', sessionId: 's-1', surface: 'page' }),
      makeEvent({
        type: 'agent_query',
        sessionId: 's-1',
        intent: 'fit',
        lens: 'recruiter',
        surface: 'page',
        runtime: 'edge-llm',
        provider: 'groq',
      }),
      makeEvent({
        type: 'agent_fit',
        sessionId: 's-1',
        lens: 'recruiter',
        matched: 8,
        gaps: 2,
      }),
      makeEvent({
        type: 'agent_share',
        sessionId: 's-1',
        kind: 'fit_link',
      }),
      // Current window — session s-2 uses ⌘K drawer with NVIDIA failover + handoff
      makeEvent({ type: 'pageview', path: '/', visitorId: 'v-2', sessionId: 's-2' }),
      makeEvent({ type: 'agent_open', visitorId: 'v-2', sessionId: 's-2', surface: 'drawer' }),
      makeEvent({
        type: 'agent_query',
        visitorId: 'v-2',
        sessionId: 's-2',
        intent: 'projects',
        lens: 'engineer',
        surface: 'drawer',
        runtime: 'edge-llm',
        provider: 'nvidia',
      }),
      makeEvent({
        type: 'agent_fit',
        visitorId: 'v-2',
        sessionId: 's-2',
        lens: 'engineer',
        matched: 6,
        gaps: 4,
      }),
      makeEvent({
        type: 'agent_handoff',
        visitorId: 'v-2',
        sessionId: 's-2',
        channel: 'firestore',
      }),
      // Previous window baseline
      makeEvent({
        type: 'agent_query',
        visitorId: 'v-0',
        sessionId: 's-0',
        intent: 'fit',
        lens: 'recruiter',
        provider: 'local',
        createdAt: withinPrevious,
      }),
    ]

    const summary = summarize(events, '7d', { now })

    // Both current sessions interacted with the dossier, so bounce rate is 0%
    expect(summary.bounceRate.current).toBe(0)
    expect(summary.agent.opens).toEqual({ current: 2, previous: 0 })
    expect(summary.agent.queries).toEqual({ current: 2, previous: 0 })
    expect(summary.agent.fitRuns).toEqual({ current: 2, previous: 0 })
    expect(summary.agent.handoffs).toEqual({ current: 1, previous: 0 })
    expect(summary.agent.shares).toEqual({ current: 1, previous: 0 })
    expect(summary.agent.avgFitMatched).toBe(7)
    expect(summary.agent.avgFitGaps).toBe(3)

    expect(summary.agent.byIntent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'fit', count: 1 }),
        expect.objectContaining({ name: 'projects', count: 1 }),
      ]),
    )
    expect(summary.agent.byLens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'recruiter', count: 1 }),
        expect.objectContaining({ name: 'engineer', count: 1 }),
      ]),
    )
    expect(summary.agent.byProvider).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'groq', count: 1 }),
        expect.objectContaining({ name: 'nvidia', count: 1 }),
      ]),
    )
    expect(summary.agent.bySurface).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'page', count: 1 }),
        expect.objectContaining({ name: 'drawer', count: 1 }),
      ]),
    )

    // CSV export includes the new dossier dimensions cleanly
    const csv = eventsToCsv(events)
    const header = csv.split('\n')[0]
    expect(header).toContain('intent,lens,surface,provider,matched,gaps')
    expect(csv).toContain(',fit,recruiter,page,groq,')
  })
})
