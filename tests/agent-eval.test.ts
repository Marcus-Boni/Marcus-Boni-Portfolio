import { describe, expect, it } from 'vitest'

import { SAMPLE_JOB_DESCRIPTIONS } from '@/agent/knowledge'
import {
  analyzeJobFit,
  classifyIntent,
  extractQuerySignals,
  looksLikeJobDescription,
} from '@/agent/retrieval'
import { LocalDeterministicRuntime } from '@/agent/runtime'
import type { AgentEvent, AgentLens, Citation, FitReport } from '@/agent/types'
import type { PostMeta } from '@/blog/types'
import { cloneDefaultContent } from '@/content/defaults'
import type { Locale } from '@/i18n/translations'

/**
 * Retrieval & Agent Eval Harness for the interactive dossier console.
 *
 * Mirrors the engineering discipline of Marcus's own Meeting Copilot:
 * deterministic assertions verifying tool routing, typo/synonym recall,
 * grounded citations with zero dangling markers, honest gap reporting, and
 * clean cancellation.
 */

const content = cloneDefaultContent()
const runtime = new LocalDeterministicRuntime()

const samplePosts: PostMeta[] = [
  {
    slug: 'rag-pgvector-avaliacao',
    lang: 'pt',
    status: 'published',
    title: 'Avaliação de busca em pipelines RAG com pgvector',
    subtitle: 'Como medir recall antes de culpar o modelo',
    excerpt: 'Notas práticas sobre isolamento por workspace, citações obrigatórias e evals no CI.',
    tags: ['IA', 'RAG', 'PostgreSQL'],
    readingMinutes: 6,
    publishedAt: '2026-09-10T12:00:00.000Z',
    updatedAt: '2026-09-10T12:00:00.000Z',
    locales: {
      pt: {
        title: 'Avaliação de busca em pipelines RAG com pgvector',
        subtitle: 'Como medir recall antes de culpar o modelo',
        excerpt: 'Notas práticas sobre isolamento por workspace, citações obrigatórias e evals no CI.',
        tags: ['IA', 'RAG', 'PostgreSQL'],
        readingMinutes: 6,
      },
      en: {
        title: 'Retrieval evaluation in pgvector RAG pipelines',
        subtitle: 'Measuring recall before blaming the model',
        excerpt: 'Field notes on workspace isolation, mandatory citations, and CI evals.',
        tags: ['AI', 'RAG', 'PostgreSQL'],
        readingMinutes: 6,
      },
    },
  },
]

async function collectTurn(
  input: string,
  options: {
    locale?: Locale
    lens?: AgentLens
    posts?: PostMeta[]
    signal?: AbortSignal
  } = {},
) {
  const events: AgentEvent[] = []
  let text = ''
  let citations: Citation[] = []
  let fitReport: FitReport | undefined
  let doneIntent: string | undefined
  const toolNames: string[] = []
  const approvalKinds: string[] = []

  for await (const event of runtime.streamTurn(input, {
    content,
    posts: options.posts ?? samplePosts,
    locale: options.locale ?? 'pt',
    lens: options.lens ?? 'recruiter',
    instant: true,
    signal: options.signal,
  })) {
    events.push(event)
    if (event.type === 'tool_start') toolNames.push(event.tool.name)
    if (event.type === 'text_delta') text += event.delta
    if (event.type === 'citations') citations = event.citations
    if (event.type === 'fit_report') fitReport = event.report
    if (event.type === 'approval_request') approvalKinds.push(event.approval.kind)
    if (event.type === 'done') doneIntent = event.intent
  }

  return { events, text, citations, fitReport, doneIntent, toolNames, approvalKinds }
}

describe('retrieval signals, synonyms & typo tolerance', () => {
  it('resolves common typos and synonyms to canonical stack entries', () => {
    const signals = extractQuerySignals('Trabalha com postgress, taury e sankia?', content)
    expect(signals.matchedTechs).toContain('PostgreSQL')
    expect(signals.matchedTechs).toContain('Tauri')
    expect(signals.matchedTechs).toContain('Sankhya ERP')
  })

  it('recognizes unlisted technologies with honest adjacent mappings', () => {
    const signals = extractQuerySignals('Experiência com kubernets, Redis e GraphQL?', content)
    const names = signals.externalTechs.map((entry) => entry.name)
    expect(names).toEqual(expect.arrayContaining(['Kubernetes', 'Redis', 'GraphQL']))
    const k8s = signals.externalTechs.find((entry) => entry.name === 'Kubernetes')
    expect(k8s?.adjacent).toContain('Docker')
  })

  it('detects pasted job descriptions automatically without requiring /fit', () => {
    const pasted = `Senior Full-Stack Engineer
- 3+ years with TypeScript, React and Next.js
- Production PostgreSQL and REST APIs
- Experience with Docker and Kubernetes`
    const signals = extractQuerySignals(pasted, content)
    expect(looksLikeJobDescription(pasted, signals)).toBe(true)
    expect(classifyIntent(pasted, content).intent).toBe('fit')
  })
})

describe('evidence-based job fit analyzer', () => {
  it('maps matched requirements to real evidence and exposes honest gaps', () => {
    const report = analyzeJobFit(SAMPLE_JOB_DESCRIPTIONS.pt.text, content, 'pt')
    const matchedSkills = report.matched.map((item) => item.skill)
    const gapTerms = report.gaps.map((gap) => gap.term)

    expect(matchedSkills).toEqual(
      expect.arrayContaining(['TypeScript', 'React', 'Next.js', 'PostgreSQL', 'Rust', 'Docker', 'MCP']),
    )
    expect(gapTerms).toEqual(expect.arrayContaining(['Kubernetes', 'Redis', 'GraphQL']))
    // Every matched item must carry at least one concrete proof
    for (const item of report.matched) {
      expect(item.proofs.length).toBeGreaterThan(0)
    }
    expect(report.markdownBrief).toContain('Briefing de Fit por Evidências')
    expect(report.markdownBrief).toContain('Kubernetes')
  })
})

describe('LocalDeterministicRuntime eval suite', () => {
  const cases: {
    label: string
    prompt: string
    locale: Locale
    lens: AgentLens
    expectedIntent: string
    expectedTools: string[]
    expectText: RegExp
  }[] = [
    {
      label: 'recruiter asks about PostgreSQL + AI in Portuguese',
      prompt: 'O Marcus tem experiência com PostgreSQL e IA em produção?',
      locale: 'pt',
      lens: 'recruiter',
      expectedIntent: 'stack',
      expectedTools: ['listTechnologies', 'getExperience', 'listProjects'],
      expectText: /PostgreSQL/i,
    },
    {
      label: 'engineer inspects Rust & MCP projects in English',
      prompt: 'Show me the Rust and MCP projects',
      locale: 'en',
      lens: 'engineer',
      expectedIntent: 'projects',
      expectedTools: ['listProjects'],
      expectText: /ISPer.*OptTime|OptTime.*ISPer/s,
    },
    {
      label: 'client asks about healthcare / ERP engagements',
      prompt: 'Quais clientes de saúde e ERP ele já atendeu na Optsolv?',
      locale: 'pt',
      lens: 'client',
      expectedIntent: 'experience',
      expectedTools: ['getExperience'],
      expectText: /Unimed|Marca Ambiental/i,
    },
    {
      label: 'engineer queries how the console and OpenAPI work',
      prompt: '/api How do this console and OpenAPI 3.1 work?',
      locale: 'en',
      lens: 'engineer',
      expectedIntent: 'api',
      expectedTools: ['getProfile'],
      expectText: /openapi\.json/i,
    },
    {
      label: 'reader searches published journal posts',
      prompt: 'O que ele escreveu no Diário sobre RAG e pgvector?',
      locale: 'pt',
      lens: 'engineer',
      expectedIntent: 'posts',
      expectedTools: ['listPosts'],
      expectText: /Avaliação de busca em pipelines RAG/i,
    },
    {
      label: 'recruiter requests CV PDF download',
      prompt: '/cv',
      locale: 'pt',
      lens: 'recruiter',
      expectedIntent: 'cv',
      expectedTools: ['getProfile'],
      expectText: /PDF/i,
    },
  ]

  for (const scenario of cases) {
    it(scenario.label, async () => {
      const result = await collectTurn(scenario.prompt, {
        locale: scenario.locale,
        lens: scenario.lens,
      })

      expect(result.doneIntent).toBe(scenario.expectedIntent)
      expect(result.toolNames).toEqual(scenario.expectedTools)
      expect(result.text).toMatch(scenario.expectText)

      // Zero dangling citations: every inline [ID] marker must exist in citations
      const markers = [...result.text.matchAll(/\[(0\d|EXP·\d{2}|POST·\d{2}|DOC·\d{2})\]/g)].map(
        (m) => m[1],
      )
      const citedIds = new Set(result.citations.map((c) => c.id))
      for (const marker of markers) {
        expect(citedIds.has(marker), `dangling citation [${marker}]`).toBe(true)
      }
    })
  }

  it('requests explicit human approval on out-of-scope / private inquiries instead of fabricating', async () => {
    const result = await collectTurn('Qual o telefone pessoal e pretensão salarial do Marcus?', {
      locale: 'pt',
    })
    expect(result.doneIntent).toBe('out_of_scope')
    expect(result.text).toMatch(/não está registrada|nunca inventa/i)
    expect(result.approvalKinds).toEqual(['send_message'])
  })

  it('requests explicit CV download approval on /cv', async () => {
    const result = await collectTurn('/cv', { locale: 'en' })
    expect(result.approvalKinds).toEqual(['download_cv'])
  })

  it('emits FitReport and handoff approval on /fit sample JD', async () => {
    const result = await collectTurn(SAMPLE_JOB_DESCRIPTIONS.en.text, {
      locale: 'en',
      lens: 'recruiter',
    })
    expect(result.doneIntent).toBe('fit')
    expect(result.toolNames).toContain('matchRole')
    expect(result.fitReport?.matched.length).toBeGreaterThanOrEqual(5)
    expect(result.fitReport?.gaps.length).toBeGreaterThanOrEqual(3)
    expect(result.approvalKinds).toEqual(['send_message'])
  })

  it('stops cleanly when AbortSignal fires', async () => {
    const controller = new AbortController()
    controller.abort()
    const result = await collectTurn('Qual o stack do Marcus?', {
      signal: controller.signal,
    })
    expect(result.events).toHaveLength(0)
  })
})
