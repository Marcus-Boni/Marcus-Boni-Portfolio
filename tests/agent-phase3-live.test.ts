import { describe, expect, it } from 'vitest'

import {
  activeKnowledgeNotes,
  cloneDefaultKnowledgeNotes,
  createEmptyKnowledgeNote,
  mergeDossierKnowledge,
  nextKnowledgeNoteId,
} from '@/agent/dossier-cms'
import { KNOWLEDGE_NOTES, type KnowledgeNote } from '@/agent/knowledge'
import {
  buildPostSectionIndex,
  extractMarkdownSections,
  extractRelevantSnippet,
} from '@/agent/post-index'
import { classifyIntent, searchKnowledge, searchPostSections } from '@/agent/retrieval'
import { prepareGroundedTurn } from '@/agent/runtime'
import { extractToc } from '@/blog/lib/text'
import type { PostMeta } from '@/blog/types'
import { cloneDefaultContent } from '@/content/defaults'

const content = cloneDefaultContent()

const samplePosts: PostMeta[] = [
  {
    slug: 'boas-praticas-de-front-end',
    lang: 'pt',
    status: 'published',
    title: 'O que aprendi sobre construir um bom front-end',
    subtitle: 'UI, acessibilidade e Core Web Vitals.',
    excerpt: 'As práticas que levo para desenhar, implementar e revisar uma interface.',
    tags: ['front-end', 'acessibilidade'],
    readingMinutes: 10,
    publishedAt: '2026-11-25T12:00:00.000Z',
    updatedAt: '2026-11-25T12:00:00.000Z',
    locales: {
      pt: {
        title: 'O que aprendi sobre construir um bom front-end',
        subtitle: 'UI, acessibilidade e Core Web Vitals.',
        excerpt: 'As práticas que levo para desenhar, implementar e revisar uma interface.',
        tags: ['front-end', 'acessibilidade'],
        readingMinutes: 10,
      },
      en: {
        title: 'What I learned about building solid front-ends',
        subtitle: 'UI, accessibility, and Core Web Vitals.',
        excerpt: 'The practices I bring to designing, implementing, and reviewing interfaces.',
        tags: ['front-end', 'accessibility'],
        readingMinutes: 10,
      },
    },
  },
]

const sampleBodyPt = `
Uma interface previsível reduz o esforço cognitivo antes mesmo do primeiro clique.

## A frequência muda a decisão de animar

Com \`prefers-reduced-motion\`, mantenho o texto e o estado visível e reduzo o deslocamento.

\`\`\`bash
# Este comentário em bash não pode virar heading
echo "ok"
\`\`\`

## Onde o tempo da pessoa está indo

Para acompanhar em produção, uso Core Web Vitals: **LCP até 2,5 s**, **INP até 200 ms** e **CLS até 0,1** no percentil 75.

## Revisão

Primeiro checklist de revisão no teclado.

## Revisão

Segundo bloco de revisão para validar sufixo duplicado.
`

const sampleBodyEn = `
Predictable interfaces reduce cognitive load before the first click.

## Where the user's time goes

In production, I track Core Web Vitals: **LCP under 2.5s**, **INP under 200ms**, and **CLS under 0.1** at p75.
`

describe('Phase 3 (Live Knowledge CMS) — dossier-cms schema & merge', () => {
  it('falls back to static KNOWLEDGE_NOTES when stored payload is missing or empty', () => {
    const empty = mergeDossierKnowledge(undefined)
    expect(empty.notes).toHaveLength(KNOWLEDGE_NOTES.length)
    expect(empty.notes[0].id).toBe('DOC·01')

    const blankList = mergeDossierKnowledge({ notes: [] })
    expect(blankList.notes).toHaveLength(KNOWLEDGE_NOTES.length)
  })

  it('sanitizes unsafe hrefs, unknown topics, duplicate keywords, and blank rows', () => {
    const merged = mergeDossierKnowledge({
      updatedAt: '2026-11-27T12:00:00.000Z',
      notes: [
        {
          id: 'DOC·07',
          topic: 'not_a_real_topic' as KnowledgeNote['topic'],
          keywords: [' Mentoria ', 'mentoria', 'Liderança', ''],
          title: { pt: 'Mentoria técnica', en: '' },
          body: { pt: 'Ajudo times com code review.', en: '' },
          href: 'javascript:alert(1)',
          enabled: true,
        },
        // Completely empty note must be dropped
        {
          id: 'DOC·08',
          topic: 'faq',
          keywords: [],
          title: { pt: '   ', en: '' },
          body: { pt: '', en: '' },
          href: '/about',
        },
      ],
    })

    expect(merged.notes).toHaveLength(1)
    expect(merged.notes[0]).toEqual({
      id: 'DOC·07',
      topic: 'faq',
      keywords: ['mentoria', 'liderança'],
      title: { pt: 'Mentoria técnica', en: 'Mentoria técnica' },
      body: { pt: 'Ajudo times com code review.', en: 'Ajudo times com code review.' },
      href: '/about',
      enabled: true,
    })
  })

  it('generates sequential DOC·NN IDs and excludes disabled notes from activeKnowledgeNotes', () => {
    const defaults = cloneDefaultKnowledgeNotes()
    expect(nextKnowledgeNoteId(defaults)).toBe('DOC·09')

    const created = createEmptyKnowledgeNote(defaults)
    expect(created.id).toBe('DOC·09')
    expect(created.topic).toBe('faq')

    const withDisabled = defaults.map((n) =>
      n.id === 'DOC·06' ? { ...n, enabled: false } : n,
    )
    expect(activeKnowledgeNotes(withDisabled).some((n) => n.id === 'DOC·06')).toBe(false)
    expect(activeKnowledgeNotes(withDisabled)).toHaveLength(defaults.length - 1)
  })
})

describe('Phase 3 (Live Knowledge CMS) — runtime uses edited notes & custom FAQs', () => {
  it('reflects live Firestore edits to DOC·01 in availability responses and citations', () => {
    const edited = cloneDefaultKnowledgeNotes().map((note) =>
      note.id === 'DOC·01'
        ? {
            ...note,
            body: {
              pt: 'Disponível a partir de janeiro de 2027 para contratos PJ remotos internacionais.',
              en: 'Available starting January 2027 for remote international contract engagements.',
            },
          }
        : note,
    )

    const planPt = prepareGroundedTurn('Qual a disponibilidade do Marcus?', {
      content,
      posts: [],
      knowledgeNotes: edited,
      locale: 'pt',
      lens: 'recruiter',
    })

    expect(planPt.intent).toBe('availability')
    expect(planPt.composed.text).toContain('janeiro de 2027')
    expect(planPt.composed.citations.find((c) => c.id === 'DOC·01')?.excerpt).toContain(
      'janeiro de 2027',
    )
  })

  it('routes custom FAQs created in /admin/dossier instead of marking them out_of_scope', () => {
    const customNotes: KnowledgeNote[] = [
      ...cloneDefaultKnowledgeNotes(),
      {
        id: 'DOC·07',
        topic: 'faq',
        keywords: ['aviso previo', 'notice period', 'transicao'],
        title: { pt: 'Aviso prévio & transição', en: 'Notice period & transition' },
        body: {
          pt: 'Prazo padrão de transição de 30 dias para garantir passagem limpa de conhecimento.',
          en: 'Standard 30-day transition window to ensure a clean handover.',
        },
        href: '/contact',
        enabled: true,
      },
    ]

    const classified = classifyIntent('Qual o aviso prévio para transição?', content, {
      knowledgeNotes: customNotes,
      locale: 'pt',
    })
    expect(classified.intent).toBe('general')
    expect(searchKnowledge('aviso prévio', 'pt', customNotes)[0]?.id).toBe('DOC·07')

    const plan = prepareGroundedTurn('Qual o aviso prévio para transição?', {
      content,
      posts: [],
      knowledgeNotes: customNotes,
      locale: 'pt',
      lens: 'recruiter',
    })
    expect(plan.composed.text).toContain('30 dias')
    expect(plan.composed.citations.some((c) => c.id === 'DOC·07')).toBe(true)
  })
})

describe('Phase 3 (Blog Body Indexing) — Markdown sections & #heading anchor parity', () => {
  it('extracts heading IDs matching extractToc / rehype-slug and ignores fenced code headings', () => {
    const toc = extractToc(sampleBodyPt)
    const sections = extractMarkdownSections(sampleBodyPt)
    const headingSections = sections.filter((sec) => sec.headingId !== '')

    expect(headingSections.map((s) => s.headingId)).toEqual(toc.map((entry) => entry.id))
    expect(headingSections.map((s) => s.headingId)).toEqual([
      'a-frequência-muda-a-decisão-de-animar',
      'onde-o-tempo-da-pessoa-está-indo',
      'revisão',
      'revisão-1',
    ])

    // Inline code identifiers stay searchable while fenced bash comments are excluded
    expect(headingSections[0].text).toContain('prefers-reduced-motion')
    expect(headingSections[0].text).not.toContain('Este comentário em bash')
  })

  it('builds bilingual section indexes with canonical #heading hrefs and retrieves deep passages', () => {
    const index = buildPostSectionIndex(samplePosts, {
      'boas-praticas-de-front-end': { pt: sampleBodyPt, en: sampleBodyEn },
    })

    const ptVitals = index.find(
      (sec) => sec.locale === 'pt' && sec.headingId === 'onde-o-tempo-da-pessoa-está-indo',
    )
    expect(ptVitals?.href).toBe(
      '/blog/boas-praticas-de-front-end#onde-o-tempo-da-pessoa-está-indo',
    )

    const enVitals = index.find(
      (sec) => sec.locale === 'en' && sec.headingId === 'where-the-users-time-goes',
    )
    expect(enVitals?.href).toBe(
      '/en/blog/boas-praticas-de-front-end#where-the-users-time-goes',
    )

    // Natural question without mentioning "blog" routes to the exact anchored section!
    const plan = prepareGroundedTurn(
      'Quais metas de Core Web Vitals LCP e INP o Marcus acompanha em produção?',
      {
        content,
        posts: samplePosts,
        postSections: index,
        locale: 'pt',
        lens: 'engineer',
      },
    )

    expect(plan.intent).toBe('posts')
    expect(plan.composed.citations[0]?.href).toBe(
      '/blog/boas-praticas-de-front-end#onde-o-tempo-da-pessoa-está-indo',
    )
    expect(plan.composed.citations[0]?.title).toContain('Onde o tempo da pessoa está indo')
    expect(plan.composed.text).toContain('LCP até 2,5 s')

    // Tool output also exposes matched sections & anchors for inspection
    const listPostsResult = plan.plannedTools[0]()
    const data = listPostsResult.data as {
      matchedSections?: { anchor: string | null; href: string }[]
    }
    expect(data.matchedSections?.[0]?.anchor).toBe('#onde-o-tempo-da-pessoa-está-indo')

    // Search helper respects active locale for bilingual posts
    const enHits = searchPostSections(
      'Core Web Vitals LCP INP',
      index,
      classifyIntent('Core Web Vitals LCP INP', content).signals,
      'en',
    )
    expect(enHits[0]?.locale).toBe('en')
    expect(enHits[0]?.href).toBe(
      '/en/blog/boas-praticas-de-front-end#where-the-users-time-goes',
    )
  })

  it('centers excerpts on the matching sentence when a long section answers in a later paragraph', () => {
    const longSection =
      'Eu mediria a abertura da rota e também a troca de período e o clique para exportar. ' +
      'Cada etapa pode ter um gargalo diferente e exige medição antes de otimizar qualquer código. ' +
      'Se a tela pula quando o conteúdo entra, verifico se imagens e outros elementos tardios têm espaço reservado no layout. ' +
      'Se o filtro demora a responder, procuro requisições independentes esperando umas pelas outras na thread principal. ' +
      'Para acompanhar em produção, uso as referências de Core Web Vitals do Google: LCP até 2,5 s, INP até 200 ms e CLS até 0,1 no percentil 75.'

    const snippet = extractRelevantSnippet(longSection, ['lcp', 'inp', 'vitals'], 260)
    expect(snippet).toContain('LCP até 2,5 s')
    expect(snippet).toContain('INP até 200 ms')
    expect(snippet.length).toBeLessThanOrEqual(270)
  })

  it('keeps strict out_of_scope guardrails even when blog sections are indexed', () => {
    const index = buildPostSectionIndex(samplePosts, {
      'boas-praticas-de-front-end': { pt: sampleBodyPt, en: sampleBodyEn },
    })
    expect(
      classifyIntent('Me passe uma receita de bolo de cenoura', content, {
        postSections: index,
        locale: 'pt',
      }).intent,
    ).toBe('out_of_scope')
    expect(
      classifyIntent('Qual o salário pretendido do Marcus?', content, {
        postSections: index,
        locale: 'pt',
      }).intent,
    ).toBe('out_of_scope')
  })
})
