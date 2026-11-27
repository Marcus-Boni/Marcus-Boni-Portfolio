import { describe, expect, it, vi } from 'vitest'

import { sanitizeCitationMarkers } from '@/agent/edge-runtime'
import { buildContextualFollowups } from '@/agent/followups'
import { buildFitPrintHtml } from '@/agent/print-brief'
import { analyzeJobFit, classifyIntent } from '@/agent/retrieval'
import { LocalDeterministicRuntime, prepareGroundedTurn } from '@/agent/runtime'
import type { AgentEvent, AgentTurn } from '@/agent/types'
import { parseTokenAlternatives } from '@/blog/lib/token-alternatives'
import { cloneDefaultContent } from '@/content/defaults'

import {
  handleGitHubActivity,
  parseGitHubContributionsHtml,
  resetGitHubActivityCache,
  type GitHubActivityPayload,
} from '../netlify/lib/github-activity'

const content = cloneDefaultContent()

const SAMPLE_CONTRIBUTIONS_HTML = `
<table>
  <tbody>
    <tr>
      <td data-date="2026-11-20" id="contribution-day-component-0-0" data-level="0"></td>
      <td data-date="2026-11-21" id="contribution-day-component-1-0" data-level="1"></td>
      <td data-date="2026-11-22" id="contribution-day-component-2-0" data-level="2"></td>
      <td data-date="2026-11-23" id="contribution-day-component-3-0" data-level="4"></td>
      <td data-date="2026-11-24" id="contribution-day-component-4-0" data-level="0"></td>
      <td data-date="2026-11-25" id="contribution-day-component-5-0" data-level="3"></td>
      <td data-date="2026-11-26" id="contribution-day-component-6-0" data-level="2"></td>
      <td data-date="2026-11-27" id="contribution-day-component-0-1" data-level="4"></td>
    </tr>
  </tbody>
</table>
<tool-tip for="contribution-day-component-0-0">No contributions on November 20th.</tool-tip>
<tool-tip for="contribution-day-component-1-0">1 contribution on November 21st.</tool-tip>
<tool-tip for="contribution-day-component-2-0">4 contributions on November 22nd.</tool-tip>
<tool-tip for="contribution-day-component-3-0">12 contributions on November 23rd.</tool-tip>
<tool-tip for="contribution-day-component-4-0">No contributions on November 24th.</tool-tip>
<tool-tip for="contribution-day-component-5-0">7 contributions on November 25th.</tool-tip>
<tool-tip for="contribution-day-component-0-1">1,024 contributions on November 27th.</tool-tip>
`

describe('Phase 4 — Live GitHub Activity Edge Handler (/agent/v1/github)', () => {
  it('parses GitHub public contributions HTML into exact daily counts, totals and streak', () => {
    const parsed = parseGitHubContributionsHtml(SAMPLE_CONTRIBUTIONS_HTML, 7)
    expect(parsed).toBeDefined()
    // 8 cells total: [0, 1, 4, 12, 0, 7, 3 (level-2 fallback), 1024]
    // Last 7 days: [1, 4, 12, 0, 7, 3, 1024]
    expect(parsed?.days).toEqual([1, 4, 12, 0, 7, 3, 1024])
    expect(parsed?.endDate).toBe('2026-11-27')
    expect(parsed?.windowTotal).toBe(1051)
    expect(parsed?.yearTotal).toBe(1051)
    expect(parsed?.activeDays).toBe(6)
    expect(parsed?.longestStreak).toBe(3)
    expect(parseGitHubContributionsHtml('<div>empty</div>')).toBeUndefined()
  })

  it('rejects non-GET/HEAD requests with 405 Method Not Allowed', async () => {
    const res = await handleGitHubActivity(
      new Request('https://marcusboni.com.br/agent/v1/github', { method: 'POST' }),
    )
    expect(res.status).toBe(405)
    expect(res.headers.get('allow')).toBe('GET, HEAD')
  })

  it('aggregates releases, non-fork repos and contributions calendar, scoping GITHUB_TOKEN to api.github.com only', async () => {
    resetGitHubActivityCache()
    const apiAuth: (string | null)[] = []
    const htmlAuth: (string | null)[] = []

    const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const headers = new Headers(init?.headers)
      if (url.startsWith('https://api.github.com/')) {
        apiAuth.push(headers.get('authorization'))
      } else {
        htmlAuth.push(headers.get('authorization'))
      }

      if (url.includes('/users/Marcus-Boni/contributions')) {
        return new Response(SAMPLE_CONTRIBUTIONS_HTML, {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        })
      }

      if (url.includes('/users/Marcus-Boni/repos')) {
        return new Response(
          JSON.stringify([
            {
              name: 'ISPer',
              description: 'Offline Rust dictation app',
              language: 'Rust',
              stargazers_count: 14,
              pushed_at: '2026-11-26T10:00:00Z',
              html_url: 'https://github.com/Marcus-Boni/ISPer',
              fork: false,
              private: false,
              topics: ['rust', 'tauri'],
            },
            {
              name: 'forked-lib',
              description: 'Should be filtered out',
              language: 'TypeScript',
              stargazers_count: 0,
              pushed_at: '2026-11-25T10:00:00Z',
              html_url: 'https://github.com/Marcus-Boni/forked-lib',
              fork: true,
              private: false,
            },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }

      if (url.includes('/repos/Marcus-Boni/ISPer/releases/latest')) {
        return new Response(
          JSON.stringify({
            tag_name: 'v0.25.0',
            name: 'ISPer v0.25.0',
            published_at: '2026-11-24T18:00:00Z',
            html_url: 'https://github.com/Marcus-Boni/ISPer/releases/tag/v0.25.0',
            body: '## Highlights\n- Faster CUDA whisper streaming\n- Improved MCP bridge',
            draft: false,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }

      return new Response('Not Found', { status: 404 })
    })
    const fetchImpl = mockFetch as unknown as typeof fetch

    const env = (key: string) => (key === 'GITHUB_TOKEN' ? 'ghp_secret_test_value_12345' : undefined)

    const first = await handleGitHubActivity(
      new Request('https://marcusboni.com.br/agent/v1/github'),
      { fetchImpl, env, now: () => 1_700_000_000_000 },
    )
    expect(first.status).toBe(200)
    const text = await first.text()
    expect(text).not.toContain('ghp_secret_test_value_12345')
    const data = JSON.parse(text) as GitHubActivityPayload
    expect(data.cached).toBe(false)
    expect(data.releases).toHaveLength(1)
    expect(data.releases[0].tag).toBe('v0.25.0')
    expect(data.releases[0].summary).toContain('Faster CUDA whisper streaming')
    expect(data.recentRepos.map((r) => r.name)).toEqual(['ISPer'])
    expect(data.contributions?.days).toHaveLength(8)
    expect(data.contributions?.windowTotal).toBe(1051)
    expect(apiAuth.length).toBeGreaterThan(0)
    expect(apiAuth.every((val) => val === 'Bearer ghp_secret_test_value_12345')).toBe(true)
    expect(htmlAuth).toEqual([null])

    const callsAfterFirst = mockFetch.mock.calls.length

    // Second request within 20 min TTL returns cached response with zero upstream calls
    const second = await handleGitHubActivity(
      new Request('https://marcusboni.com.br/agent/v1/github'),
      { fetchImpl, env, now: () => 1_700_000_060_000 },
    )
    expect(second.status).toBe(200)
    const secondData = (await second.json()) as GitHubActivityPayload
    expect(secondData.cached).toBe(true)
    expect(secondData.contributions?.endDate).toBe('2026-11-27')
    expect(mockFetch.mock.calls.length).toBe(callsAfterFirst)
  })

  it('returns 503 RFC 9457 problem+json when upstream fails and no cache is present', async () => {
    const failingFetch = vi.fn(async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch

    const res = await handleGitHubActivity(
      new Request('https://marcusboni.com.br/agent/v1/github'),
      { fetchImpl: failingFetch, cache: null },
    )
    expect(res.status).toBe(503)
    expect(res.headers.get('content-type')).toContain('application/problem+json')
  })
})

describe('Phase 4 — Live GitHub Tool, Citations & Offline Fallback', () => {
  const sampleActivity: GitHubActivityPayload = {
    username: 'Marcus-Boni',
    fetchedAt: '2026-11-27T12:00:00.000Z',
    cached: false,
    releases: [
      {
        repo: 'ISPer',
        tag: 'v0.25.0',
        name: 'ISPer v0.25.0',
        publishedAt: '2026-11-24T18:00:00Z',
        url: 'https://github.com/Marcus-Boni/ISPer/releases/tag/v0.25.0',
        summary: 'Streaming CUDA transcription and MCP integration',
      },
    ],
    recentRepos: [
      {
        name: 'OptTime',
        description: 'Time tracking with Azure DevOps + 16-tool MCP server',
        language: 'TypeScript',
        stars: 8,
        pushedAt: '2026-11-26T09:00:00Z',
        url: 'https://github.com/Marcus-Boni/OptTime',
        topics: ['mcp', 'nextjs'],
      },
    ],
    contributions: {
      days: [0, 2, 5, 1, 8, 3, 4],
      endDate: '2026-11-27',
      windowTotal: 23,
      yearTotal: 420,
      activeDays: 6,
      longestStreak: 6,
    },
  }

  it('routes activity and heatmap queries to getRecentActivity and emits verifiable GH·NN citations + github_activity event', async () => {
    expect(classifyIntent('/activity', content).intent).toBe('activity')
    expect(classifyIntent('Quais são as últimas releases no GitHub?', content).intent).toBe('activity')
    expect(classifyIntent('Mostre o mapa de contribuições do GitHub', content).intent).toBe('activity')
    expect(classifyIntent('Show me the GitHub contribution graph heatmap', content).intent).toBe('activity')
    expect(classifyIntent('What has Marcus built recently?', content).intent).toBe('activity')

    const plan = prepareGroundedTurn('Mostre o mapa de calor e atividade no GitHub', {
      content,
      posts: [],
      githubActivity: sampleActivity,
      locale: 'pt',
      lens: 'engineer',
    })

    expect(plan.intent).toBe('activity')
    expect(plan.plannedTools[0]().name).toBe('getRecentActivity')
    expect(plan.composed.text).toContain('ISPer v0.25.0')
    expect(plan.composed.text).toContain('23 contribuições')
    expect(plan.composed.githubActivity?.contributions?.windowTotal).toBe(23)
    expect(plan.composed.citations[0]?.id).toBe('GH·01')
    expect(plan.composed.citations[0]?.title).toContain('23 contribuições')
    expect(plan.composed.citations[1]?.id).toBe('GH·02')
    expect(plan.composed.citations[1]?.href).toContain('/ISPer/releases/tag/v0.25.0')

    // LocalDeterministicRuntime must emit the structured github_activity event for ActivityTerrain
    const runtime = new LocalDeterministicRuntime()
    const events: AgentEvent[] = []
    for await (const ev of runtime.streamTurn('Mapa de contribuições no GitHub', {
      content,
      posts: [],
      githubActivity: sampleActivity,
      locale: 'pt',
      lens: 'engineer',
      instant: true,
    })) {
      events.push(ev)
    }
    const ghEvent = events.find(
      (ev): ev is Extract<AgentEvent, { type: 'github_activity' }> => ev.type === 'github_activity',
    )
    expect(ghEvent?.activity.contributions?.days).toEqual([0, 2, 5, 1, 8, 3, 4])

    // Citation sanitizer keeps verified GH·01 and strips unverified GH·99
    expect(
      sanitizeCitationMarkers('Release real [GH·01] e fake [GH·99].', new Set(['GH·01'])),
    ).toBe('Release real [GH·01] e fake.')
  })

  it('degrades cleanly to featured static projects when live GitHub activity is unavailable', () => {
    const plan = prepareGroundedTurn('/activity', {
      content,
      posts: [],
      githubActivity: null,
      locale: 'en',
      lens: 'recruiter',
    })

    expect(plan.composed.citations.length).toBeGreaterThan(0)
    expect(plan.composed.citations[0]?.id).toBe('01')
  })
})

describe('Phase 4 — Deterministic Contextual Follow-ups & Executive Fit PDF Print', () => {
  it('generates non-redundant contextual follow-up pills without spending LLM tokens', () => {
    const lastTurn: AgentTurn = {
      id: 'a-1',
      role: 'assistant',
      text: 'ISPer uses Rust and Tauri 2.',
      lens: 'engineer',
      locale: 'pt',
      intent: 'projects',
      tools: [],
      citations: [
        {
          id: '01',
          kind: 'project',
          title: 'ISPer',
          subtitle: '2026 · Rust',
          excerpt: 'Offline dictation',
          href: 'https://github.com/Marcus-Boni/ISPer',
          external: true,
        },
      ],
      createdAt: Date.now(),
    }

    const history: AgentTurn[] = [
      {
        id: 'u-1',
        role: 'user',
        text: 'Últimas releases e atividade no GitHub',
        lens: 'engineer',
        locale: 'pt',
        tools: [],
        citations: [],
        createdAt: Date.now(),
      },
      lastTurn,
    ]

    const suggestions = buildContextualFollowups(lastTurn, history, 'pt', 'engineer')
    expect(suggestions.length).toBeGreaterThanOrEqual(2)
    expect(suggestions.length).toBeLessThanOrEqual(3)
    expect(suggestions[0]).toContain('ISPer')
    // Already-asked question must be deduplicated
    expect(suggestions).not.toContain('Últimas releases e atividade no GitHub')

    // Never show follow-ups while streaming
    expect(
      buildContextualFollowups({ ...lastTurn, streaming: true }, history, 'pt', 'engineer'),
    ).toEqual([])
  })

  it('builds a safe, HTML-escaped A4 print one-pager from a FitReport', () => {
    const report = analyzeJobFit(
      '/fit <script>alert(1)</script> Senior React TypeScript Rust Kubernetes Engineer',
      content,
      'en',
    )
    const html = buildFitPrintHtml(report, {
      locale: 'en',
      profileName: content.profile.name,
      role: content.profile.role,
      location: content.profile.location,
      email: content.profile.email,
      origin: 'https://marcusboni.com.br',
    })

    expect(html).toContain('@page { size: A4;')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('React')
    expect(html).toContain('Kubernetes')
  })
})

describe('Phase 4 — Blog Interactive Directives (::dossier-ask & :::ai-tokens)', () => {
  it('parses :::ai-tokens distributions and static prose lines accurately', () => {
    const slots = parseTokenAlternatives(`
      16 ferramentas (74% | 12 endpoints:14% | 8 recursos:8%)
      para agentes (82% | a clientes:11% | via HTTP:7%)
      em produção
    `)

    expect(slots).toHaveLength(3)
    expect(slots[0].chosen).toEqual({ text: '16 ferramentas', prob: 74 })
    expect(slots[0].alternatives).toEqual([
      { text: '12 endpoints', prob: 14 },
      { text: '8 recursos', prob: 8 },
    ])
    expect(slots[2]).toEqual({
      chosen: { text: 'em produção', prob: 100 },
      alternatives: [],
    })
  })

  it('renders ::dossier-ask and :::ai-tokens cleanly in SSR/crawler HTML (blog-html.ts)', async () => {
    vi.stubGlobal('Deno', { env: { get: () => undefined } })
    const { renderMarkdown } = await import('../netlify/lib/blog-html')
    const md = [
      '::dossier-ask{lens=engineer q="Como o servidor MCP do OptTime funciona?"}',
      '',
      ':::ai-tokens{prompt="O servidor MCP expõe"}',
      '16 ferramentas (74% | 12 endpoints:14%)',
      'para agentes (82% | via HTTP:18%)',
      ':::',
    ].join('\n')

    const ptHtml = renderMarkdown(md, {}, 'pt')
    expect(ptHtml).toContain('/ask?lens=engineer&amp;q=Como+o+servidor+MCP+do+OptTime+funciona%3F')
    expect(ptHtml).toContain('Perguntar no Dossiê')
    expect(ptHtml).toContain('O servidor MCP expõe 16 ferramentas para agentes')

    const enHtml = renderMarkdown(md, {}, 'en')
    expect(enHtml).toContain('/en/ask?lens=engineer&amp;q=')
    expect(enHtml).toContain('Ask Dossier')
  })
})
