import type { PostMeta } from '@/blog/types'
import type { ExperienceProject, Project, SiteContent } from '@/content/types'
import { cvFiles } from '@/data/profile'
import type { Locale } from '@/i18n/translations'

import { KNOWLEDGE_NOTES } from './knowledge'
import {
  analyzeJobFit,
  classifyIntent,
  searchEngagements,
  searchKnowledge,
  searchPosts,
  searchProjects,
  searchTechnologies,
  type QuerySignals,
} from './retrieval'
import {
  runGetExperience,
  runGetProfile,
  runListPosts,
  runListProjects,
  runListTechnologies,
  runMatchRole,
  runPrepareHandoff,
  type ToolExecutionResult,
} from './tools'
import type {
  AgentEvent,
  AgentHistoryEntry,
  AgentIntent,
  AgentLens,
  AgentRuntime,
  AgentRuntimeContext,
  ApprovalAction,
  Citation,
  FitReport,
} from './types'

/**
 * Phase 1 deterministic local agent runtime.
 *
 * Executes real tools against the live `SiteContent` and published posts, emits
 * structured `tool_start` / `tool_result` traces, composes lens-aware bilingual
 * responses with verifiable inline citations (`[01]`, `[EXP·01]`, `[POST·01]`,
 * `[DOC·01]`), and requests explicit human approval before any side effect.
 */

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve()
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      resolve()
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function projectCitation(project: Project, locale: Locale): Citation {
  return {
    id: project.index,
    kind: 'project',
    title: project.title,
    subtitle: `${project.year} · ${project.stack.join(', ')}`,
    excerpt: project.description[locale],
    href: project.url,
    external: true,
    meta: 'GitHub',
  }
}

function engagementCitation(
  eng: ExperienceProject,
  ordinal: number,
  locale: Locale,
): Citation {
  return {
    id: `EXP·${String(ordinal).padStart(2, '0')}`,
    kind: 'experience',
    title: `${eng.client} — ${eng.title[locale]}`,
    subtitle: `${eng.sector[locale]} · ${eng.stack.join(', ')}`,
    excerpt: eng.scope[locale],
    href: '/#experience',
    meta: 'Optsolv',
  }
}

function postCitation(post: PostMeta, ordinal: number, locale: Locale): Citation {
  const view = post.locales?.[locale]
  const title = view?.title || post.title
  const excerpt = view?.excerpt || post.excerpt || view?.subtitle || post.subtitle || ''
  const minutes = view?.readingMinutes ?? post.readingMinutes
  const hasEn = Boolean(post.locales?.en) || post.lang === 'en'
  const href = locale === 'en' && hasEn ? `/en/blog/${post.slug}` : `/blog/${post.slug}`
  return {
    id: `POST·${String(ordinal).padStart(2, '0')}`,
    kind: 'post',
    title,
    subtitle:
      locale === 'pt'
        ? `${minutes} min de leitura · ${(view?.tags ?? post.tags).join(', ')}`
        : `${minutes} min read · ${(view?.tags ?? post.tags).join(', ')}`,
    excerpt,
    href,
    meta: locale === 'pt' ? 'Diário' : 'Notes',
  }
}

function noteCitation(noteId: string, locale: Locale): Citation | null {
  const note = KNOWLEDGE_NOTES.find((item) => item.id === noteId)
  if (!note) return null
  return {
    id: note.id,
    kind: note.topic === 'api_readiness' ? 'api' : 'profile',
    title: note.title[locale],
    subtitle: note.href,
    excerpt: note.body[locale],
    href: note.href,
    meta: locale === 'pt' ? 'Dossiê' : 'Dossier',
  }
}

function dedupeCitations(list: Citation[]): Citation[] {
  const seen = new Set<string>()
  const out: Citation[] = []
  for (const item of list) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
  }
  return out
}

function lensLead(lens: AgentLens, locale: Locale): {
  fitIntro: string
  stackIntro: string
  projectsIntro: string
  experienceIntro: string
} {
  if (locale === 'pt') {
    if (lens === 'engineer') {
      return {
        fitIntro: 'Cruzei os requisitos técnicos diretamente contra o stack, os repositórios públicos e as entregas em produção:',
        stackIntro: 'Resumo técnico direto por camada e onde cada tecnologia aparece em código ou produção:',
        projectsIntro: 'Os repositórios abaixo documentam decisões de arquitetura, sistemas locais e IA aplicada:',
        experienceIntro: 'Em produção pela Optsolv (desde jun/2024), o foco tem sido arquitetura ponta a ponta e integrações corporativas:',
      }
    }
    if (lens === 'client') {
      return {
        fitIntro: 'Mapeei o escopo informado contra entregas já feitas em produção e projetos de referência:',
        stackIntro: 'As ferramentas abaixo sustentam entregas da interface ao deploy — sempre escolhidas pelo problema de negócio:',
        projectsIntro: 'Estes projetos mostram produtos completos tirados do papel — do fluxo operacional ao software nativo:',
        experienceIntro: 'Na Optsolv, Marcus atua direto com clientes do discovery ao deploy em produção em sete setores:',
      }
    }
    return {
      fitIntro: 'Analisei os requisitos da vaga contra todas as evidências públicas do dossiê (sem notas inventadas):',
      stackIntro: 'Aqui está o recorte verificado de tecnologias e onde cada uma foi aplicada na prática:',
      projectsIntro: 'Projetos públicos que comprovam entrega prática em full-stack, sistemas locais e IA aplicada:',
      experienceIntro: 'Experiência profissional atual como Software Developer na Optsolv (jun/2024 — presente), com sete clientes em produção:',
    }
  }

  if (lens === 'engineer') {
    return {
      fitIntro: 'Cross-checked the technical requirements against the published stack, public repositories, and production deliveries:',
      stackIntro: 'Direct technical breakdown by layer and where each tool is proven in code or production:',
      projectsIntro: 'These repositories show concrete architecture decisions across native systems, MCP, and RAG:',
      experienceIntro: 'In production at Optsolv (since Jun 2024), the work centers on end-to-end architecture and enterprise integrations:',
    }
  }
  if (lens === 'client') {
    return {
      fitIntro: 'Mapped your scope against real production deliveries and shipped reference products:',
      stackIntro: 'These technologies support end-to-end delivery from UI to production — chosen around the business problem:',
      projectsIntro: 'Shipped products demonstrating operational tools, applied AI, and native desktop software:',
      experienceIntro: 'At Optsolv, Marcus works directly with clients from discovery through production across seven industries:',
    }
  }
  return {
    fitIntro: 'Analyzed the role requirements against all verified evidence in the public dossier (no fabricated scores):',
    stackIntro: 'Here is the verified technology breakdown paired with real project and client evidence:',
    projectsIntro: 'Public repositories demonstrating hands-on delivery across full-stack, native systems, and applied AI:',
    experienceIntro: 'Current role: Software Developer at Optsolv (Jun 2024 — present), with seven client deliveries in production:',
  }
}

interface ComposedTurn {
  text: string
  citations: Citation[]
  fitReport?: FitReport
  approval?: ApprovalAction
}

function buildHandoffApproval(
  locale: Locale,
  subject: string,
  prefillMessage: string,
): ApprovalAction {
  return {
    id: makeId('approval'),
    kind: 'send_message',
    title:
      locale === 'pt'
        ? 'Enviar direto para o inbox do Marcus'
        : 'Send directly to Marcus’s inbox',
    description:
      locale === 'pt'
        ? 'Revise os campos abaixo. Nada é enviado sem a sua confirmação explícita.'
        : 'Review the fields below. Nothing is sent without your explicit confirmation.',
    status: 'pending',
    draft: {
      subject,
      message: prefillMessage,
    },
  }
}

function buildCvApproval(locale: Locale): ApprovalAction {
  return {
    id: makeId('approval'),
    kind: 'download_cv',
    title: locale === 'pt' ? 'Baixar currículo em PDF' : 'Download PDF résumé',
    description:
      locale === 'pt'
        ? `Versão atualizada disponível em português (${cvFiles.pt}) e inglês (${cvFiles.en}).`
        : `Latest edition available in English (${cvFiles.en}) and Portuguese (${cvFiles.pt}).`,
    status: 'pending',
    cvLocale: locale,
  }
}

function composeResponse(params: {
  intent: ReturnType<typeof classifyIntent>['intent']
  query: string
  rawInput: string
  signals: QuerySignals
  content: SiteContent
  posts: PostMeta[]
  locale: Locale
  lens: AgentLens
}): ComposedTurn {
  const { intent, query, rawInput, signals, content, posts, locale, lens } = params
  const isPt = locale === 'pt'
  const lead = lensLead(lens, locale)
  const citations: Citation[] = []

  const addNote = (id: string) => {
    const cit = noteCitation(id, locale)
    if (cit) citations.push(cit)
  }

  const engOrdinal = (id: string) =>
    content.experience.projects.findIndex((item) => item.id === id) + 1

  switch (intent) {
    case 'fit': {
      const report = analyzeJobFit(rawInput, content, locale)
      for (const proj of report.relevantProjects.slice(0, 3)) {
        const found = content.projects.find((p) => p.index === proj.index)
        if (found) citations.push(projectCitation(found, locale))
      }
      for (const eng of report.relevantEngagements.slice(0, 3)) {
        const found = content.experience.projects.find((e) => e.id === eng.id)
        if (found) citations.push(engagementCitation(found, engOrdinal(found.id), locale))
      }
      addNote('DOC·01')

      const verifiedCount = report.matched.length
      const gapCount = report.gaps.length
      const lines: string[] = [lead.fitIntro]

      if (verifiedCount > 0) {
        const topSkills = report.matched
          .slice(0, 6)
          .map((item) => item.skill)
          .join(', ')
        const topRef = citations[0] ? ` [${citations[0].id}]` : ''
        lines.push(
          isPt
            ? `Encontrei evidência direta para **${verifiedCount} requisito(s)** (${topSkills})${topRef}.`
            : `Found verified evidence for **${verifiedCount} requirement(s)** (${topSkills})${topRef}.`,
        )
      } else {
        lines.push(
          isPt
            ? 'Cole a lista de tecnologias, responsabilidades ou descrição completa da vaga após `/fit` para gerar o mapa de evidências.'
            : 'Paste the full tech stack, responsibilities, or job description after `/fit` to generate the evidence map.',
        )
      }

      if (gapCount > 0) {
        const gapList = report.gaps.map((g) => g.term).join(', ')
        lines.push(
          isPt
            ? `Com transparência: **${gapList}** não constam no dossiê público — listei abaixo as tecnologias adjacentes que Marcus domina.`
            : `In full transparency: **${gapList}** are not listed in the public dossier — adjacent experience is mapped in the report below.`,
        )
      }

      lines.push(
        isPt
          ? 'Você pode copiar o briefing completo em Markdown ou enviar a vaga diretamente para o inbox do Marcus abaixo [DOC·01].'
          : 'You can copy the full Markdown brief or send this role straight to Marcus’s inbox below [DOC·01].',
      )

      const handoffBody = report.roleHint
        ? isPt
          ? `Olá Marcus, rodei a análise de fit no seu portfólio para: ${report.roleHint}.\n\nRequisitos comprovados: ${report.matched.map((m) => m.skill).join(', ') || 'a detalhar'}.\nGostaria de conversar sobre a oportunidade.`
          : `Hi Marcus, I ran a role fit check on your portfolio for: ${report.roleHint}.\n\nVerified requirements: ${report.matched.map((m) => m.skill).join(', ') || 'to discuss'}.\nI would like to discuss this opportunity.`
        : isPt
          ? 'Olá Marcus, gostaria de compartilhar uma vaga e conversar sobre aderência.'
          : 'Hi Marcus, I would like to share a role and discuss fit.'

      return {
        text: lines.join('\n\n'),
        citations: dedupeCitations(citations),
        fitReport: report,
        approval:
          verifiedCount > 0 || gapCount > 0
            ? buildHandoffApproval(
                locale,
                report.roleHint ?? (isPt ? 'Oportunidade / Vaga' : 'Role Opportunity'),
                handoffBody,
              )
            : undefined,
      }
    }

    case 'stack': {
      const matchedStack = searchTechnologies(content, signals)
      const matchedProjects = searchProjects(query, content, signals).slice(0, 3)
      const matchedEngagements = searchEngagements(query, content, signals).slice(0, 3)

      for (const proj of matchedProjects) citations.push(projectCitation(proj, locale))
      for (const eng of matchedEngagements) {
        citations.push(engagementCitation(eng, engOrdinal(eng.id), locale))
      }

      const paragraphs: string[] = []

      if (signals.matchedTechs.length > 0) {
        paragraphs.push(lead.stackIntro)
        const names = signals.matchedTechs.join(', ')
        const projectRefs = matchedProjects
          .map((p) => `**${p.title}** [${p.index}]`)
          .join(', ')
        const clientRefs = matchedEngagements
          .map((e) => `**${e.client.split(' - ')[0]}** [EXP·${String(engOrdinal(e.id)).padStart(2, '0')}]`)
          .join(', ')

        const proofParts: string[] = []
        if (clientRefs) {
          proofParts.push(
            isPt ? `em produção nos clientes ${clientRefs}` : `in production for ${clientRefs}`,
          )
        }
        if (projectRefs) {
          proofParts.push(
            isPt ? `nos projetos públicos ${projectRefs}` : `in public projects ${projectRefs}`,
          )
        }

        paragraphs.push(
          proofParts.length > 0
            ? isPt
              ? `Sim — há evidência direta para **${names}** ${proofParts.join(' e ')}.`
              : `Yes — there is direct evidence for **${names}** ${proofParts.join(' and ')}.`
            : isPt
              ? `**${names}** faz parte do stack publicado (${matchedStack.map((t) => `${t.name} · ${t.category}`).join(', ')}).`
              : `**${names}** is part of the published stack (${matchedStack.map((t) => `${t.name} · ${t.category}`).join(', ')}).`,
        )
      } else if (signals.externalTechs.length === 0) {
        paragraphs.push(lead.stackIntro)
        const groups: Record<'frontend' | 'backend' | 'data' | 'ops', string[]> = {
          frontend: [],
          backend: [],
          data: [],
          ops: [],
        }
        for (const tech of content.techStack) groups[tech.category].push(tech.name)
        paragraphs.push(
          isPt
            ? [
                `- **Interfaces:** ${groups.frontend.join(', ')}`,
                `- **Serviços & APIs:** ${groups.backend.join(', ')}`,
                `- **Dados:** ${groups.data.join(', ')}`,
                `- **Infraestrutura:** ${groups.ops.join(', ')}`,
              ].join('\n')
            : [
                `- **Interfaces:** ${groups.frontend.join(', ')}`,
                `- **Services & APIs:** ${groups.backend.join(', ')}`,
                `- **Data:** ${groups.data.join(', ')}`,
                `- **Infrastructure:** ${groups.ops.join(', ')}`,
              ].join('\n'),
        )
      }

      if (signals.externalTechs.length > 0) {
        const gapLines = signals.externalTechs.map((ext) =>
          ext.adjacent.length > 0
            ? isPt
              ? `- **${ext.name}**: não consta no dossiê público (experiência adjacente registrada: ${ext.adjacent.join(', ')}).`
              : `- **${ext.name}**: not listed in the public dossier (recorded adjacent experience: ${ext.adjacent.join(', ')}).`
            : isPt
              ? `- **${ext.name}**: não consta no dossiê público.`
              : `- **${ext.name}**: not listed in the public dossier.`,
        )
        paragraphs.push(
          (isPt
            ? 'Sobre itens que **não** constam no dossiê público:\n'
            : 'Regarding items **not** listed in the public dossier:\n') + gapLines.join('\n'),
        )
      }

      return {
        text: paragraphs.join('\n\n'),
        citations: dedupeCitations(citations),
        approval:
          signals.externalTechs.length > 0 && signals.matchedTechs.length === 0
            ? buildHandoffApproval(
                locale,
                isPt ? 'Dúvida técnica sobre stack' : 'Technical stack question',
                isPt
                  ? `Olá Marcus, consultei seu dossiê sobre: "${query}". Você já trabalhou com isso em algum projeto fora do portfólio público?`
                  : `Hi Marcus, I checked your dossier about: "${query}". Have you worked with this outside your public portfolio?`,
              )
            : undefined,
      }
    }

    case 'projects': {
      const hits = searchProjects(query, content, signals)
      const list = hits.length > 0 ? hits.slice(0, 5) : content.projects
      for (const proj of list) citations.push(projectCitation(proj, locale))

      const items = list.map(
        (proj) =>
          `- **${proj.title}** (${proj.year} · ${proj.stack.join(', ')}) [${proj.index}] — ${proj.description[locale]}`,
      )
      const footerLine = isPt
        ? `Além destes destaques, o GitHub reúne **${content.profile.repoCount}+ repositórios públicos**.`
        : `Beyond these highlights, GitHub hosts **${content.profile.repoCount}+ public repositories**.`

      return {
        text: [lead.projectsIntro, items.join('\n'), footerLine].join('\n\n'),
        citations: dedupeCitations(citations),
      }
    }

    case 'experience': {
      const hits = searchEngagements(query, content, signals)
      const list = hits.length > 0 ? hits : content.experience.projects
      for (const eng of list) {
        citations.push(engagementCitation(eng, engOrdinal(eng.id), locale))
      }
      addNote('DOC·02')

      const items = list.map((eng) => {
        const tag = `EXP·${String(engOrdinal(eng.id)).padStart(2, '0')}`
        return `- **${eng.client}** (${eng.sector[locale]} — *${eng.title[locale]}*) [${tag}]: ${eng.scope[locale]}`
      })

      return {
        text: [lead.experienceIntro, items.join('\n'), isPt ? 'Atuação ponta a ponta do discovery ao deploy em produção [DOC·02].' : 'End-to-end delivery from discovery through production deployment [DOC·02].'].join('\n\n'),
        citations: dedupeCitations(citations),
      }
    }

    case 'ai_work': {
      const aiProjects = content.projects.filter((p) =>
        /MCP|RAG|AI|whisper|Copilot/i.test(`${p.stack.join(' ')} ${p.description.en}`),
      )
      const aiClients = content.experience.projects.filter((e) =>
        /\bAI\b|N8N/i.test(`${e.stack.join(' ')} ${e.scope.en}`),
      )
      for (const proj of aiProjects) citations.push(projectCitation(proj, locale))
      for (const eng of aiClients) citations.push(engagementCitation(eng, engOrdinal(eng.id), locale))
      addNote('DOC·03')

      const intro = isPt
        ? 'Marcus trata IA como engenharia aplicada — com foco em protocolos, recuperação verificável e sistemas locais, nunca em demos frágeis [DOC·03]:'
        : 'Marcus approaches AI as applied systems engineering — focused on protocols, verifiable retrieval, and local execution rather than brittle demos [DOC·03]:'

      const bullets = [
        ...aiProjects.map(
          (p) => `- **${p.title}** [${p.index}] (${p.stack.join(', ')}): ${p.description[locale]}`,
        ),
        ...aiClients.map((e) => {
          const tag = `EXP·${String(engOrdinal(e.id)).padStart(2, '0')}`
          return `- **${e.client} — ${e.title[locale]}** [${tag}]: ${e.scope[locale]}`
        }),
      ]

      return {
        text: [intro, bullets.join('\n')].join('\n\n'),
        citations: dedupeCitations(citations),
      }
    }

    case 'posts': {
      const hits = searchPosts(query, posts, signals)
      hits.forEach((post, idx) => citations.push(postCitation(post, idx + 1, locale)))

      if (posts.length === 0) {
        addNote('DOC·05')
        return {
          text: isPt
            ? 'O Diário técnico vive em `/blog` (com feed em `/rss.xml` e API viva em `/api/v1/posts`) [DOC·05]. No momento nenhum registro publicado foi retornado nesta sessão — você pode conferir diretamente em `/blog`.'
            : 'The technical journal lives at `/blog` (with `/rss.xml` and a live endpoint at `/api/v1/posts`) [DOC·05]. No published entries were returned in this session — you can browse `/en/blog` directly.',
          citations: dedupeCitations(citations),
        }
      }

      const intro = isPt
        ? `Encontrei **${hits.length} registro(s)** no Diário técnico (de ${posts.length} publicados):`
        : `Found **${hits.length} entry(ies)** in the technical journal (out of ${posts.length} published):`

      const lines = hits.map((post, idx) => {
        const view = post.locales?.[locale]
        const title = view?.title || post.title
        const excerpt = view?.excerpt || post.excerpt || ''
        const tag = `POST·${String(idx + 1).padStart(2, '0')}`
        return `- **${title}** [${tag}]${excerpt ? ` — ${excerpt}` : ''}`
      })

      return {
        text: [intro, lines.join('\n')].join('\n\n'),
        citations: dedupeCitations(citations),
      }
    }

    case 'cv': {
      addNote('DOC·01')
      addNote('DOC·04')
      return {
        text: isPt
          ? 'Os currículos atualizados em PDF estão disponíveis nas versões **PT-BR** e **EN** [DOC·01] [DOC·04]. Use o card abaixo para baixar diretamente:'
          : 'Up-to-date PDF résumés are ready in both **English** and **Portuguese** [DOC·01] [DOC·04]. Use the action card below to download directly:',
        citations: dedupeCitations(citations),
        approval: buildCvApproval(locale),
      }
    }

    case 'availability': {
      addNote('DOC·01')
      addNote('DOC·04')
      addNote('DOC·06')
      const availabilityLine = content.profile.available
        ? isPt
          ? 'Status atual no site: **aberto a projetos e oportunidades** [DOC·01].'
          : 'Current public status: **open to projects and opportunities** [DOC·01].'
        : isPt
          ? 'Status atual no site: agenda reservada no momento, mas aberto a conversas futuras [DOC·01].'
          : 'Current public status: booked at the moment, though open to future conversations [DOC·01].'

      return {
        text: [
          availabilityLine,
          isPt
            ? `- **Localização & fuso:** ${content.profile.location} (UTC−3)\n- **Idiomas:** Português (nativo) e Inglês (profissional) [DOC·04]\n- **Formatos:** efetivo, contrato, freelance, consultoria técnica ou segunda opinião em arquitetura e IA [DOC·01]\n- **Canal principal:** ${content.profile.email} ou formulário direto abaixo [DOC·06]`
            : `- **Location & timezone:** ${content.profile.location} (UTC−3)\n- **Languages:** Native Portuguese and professional English [DOC·04]\n- **Formats:** full-time, contract, freelance, technical consulting, or architecture/AI second opinion [DOC·01]\n- **Front door:** ${content.profile.email} or the direct inbox form below [DOC·06]`,
        ].join('\n\n'),
        citations: dedupeCitations(citations),
        approval: buildHandoffApproval(
          locale,
          isPt ? 'Disponibilidade / Oportunidade' : 'Availability / Opportunity',
          isPt
            ? 'Olá Marcus, vi sua disponibilidade no dossiê e gostaria de conversar sobre uma oportunidade (formato, prazo e escopo).'
            : 'Hi Marcus, I checked your availability in the dossier and would like to discuss an opportunity (format, timeline, and scope).',
        ),
      }
    }

    case 'contact': {
      addNote('DOC·06')
      addNote('DOC·02')
      const draftMsg = query && !/^(\/contact)?$/i.test(query)
        ? query
        : isPt
          ? 'Olá Marcus, gostaria de conversar sobre uma oportunidade / projeto.'
          : 'Hi Marcus, I would like to discuss an opportunity / project.'
      return {
        text: isPt
          ? `A porta de entrada é o e-mail **${content.profile.email}** ou este envio direto para o inbox do painel administrativo [DOC·06]. Para agilizar, inclua o problema/escopo, prazo e formato [DOC·02].`
          : `The front door is **${content.profile.email}** or a direct submission to the site inbox below [DOC·06]. Including the problem/scope, timeline, and engagement format speeds things up [DOC·02].`,
        citations: dedupeCitations(citations),
        approval: buildHandoffApproval(
          locale,
          isPt ? 'Contato via Dossiê' : 'Dossier Handoff',
          draftMsg,
        ),
      }
    }

    case 'api': {
      addNote('DOC·05')
      return {
        text: isPt
          ? [
              'Este console roda uma arquitetura **híbrida de Agente de Dossiê** (recuperação determinística + síntese opcional via Edge LLM) [DOC·05]:',
              '- **Grounding determinístico primeiro:** normalização bilíngue, ontologia técnica, busca híbrida (BM25 + trigramas) e ferramentas que espelham `/openapi.json` extraem evidências, citações e o relatório `/fit` com zero alucinação.',
              '- **Streaming SSE na Edge (`POST /agent/v1/chat`):** quando há uma chave de LLM configurada no servidor da Netlify (OpenAI, Gemini, Anthropic, Groq ou OpenRouter), a síntese em linguagem natural faz streaming token a token sobre as evidências verificadas — com rate limit por IP, proteção contra prompt injection e fallback automático para o motor local.',
              '- **Superfície aberta para máquinas:** inspecione `/openapi.json`, `/llms.txt`, `/api/v1/profile`, `GET /agent/v1/chat` ou `curl -H "Accept: text/markdown" https://marcusboni.com.br/` em `/developers` [DOC·05].',
            ].join('\n\n')
          : [
              'This console runs a **hybrid Dossier Agent architecture** (deterministic grounding + optional Edge LLM synthesis) [DOC·05]:',
              '- **Deterministic grounding first:** bilingual normalization, tech ontology, hybrid BM25 + trigram retrieval, and tools mirroring `/openapi.json` extract verified evidence, citations, and `/fit` ledgers with zero hallucination.',
              '- **Edge SSE streaming (`POST /agent/v1/chat`):** when a server-side LLM key is configured on Netlify (OpenAI, Gemini, Anthropic, Groq, or OpenRouter), natural prose streams token by token grounded strictly in retrieved evidence — with per-IP rate limiting, prompt-injection hardening, and silent local fallback.',
              '- **Machine-readable surface:** inspect `/openapi.json`, `/llms.txt`, `/api/v1/profile`, `GET /agent/v1/chat`, or `curl -H "Accept: text/markdown" https://marcusboni.com.br/` at `/developers` [DOC·05].',
            ].join('\n\n'),
        citations: dedupeCitations(citations),
      }
    }

    case 'profile': {
      addNote('DOC·01')
      addNote('DOC·03')
      for (const proj of content.projects.slice(0, 2)) {
        citations.push(projectCitation(proj, locale))
      }
      return {
        text: isPt
          ? [
              `**${content.profile.fullName}** (${content.profile.name}) é engenheiro de software baseado no ${content.profile.location} e **${content.experience.role} na ${content.experience.company}** desde junho de 2024 [DOC·01].`,
              `Constrói aplicações full-stack (TypeScript, React, Next.js, Node.js, C#, PostgreSQL), sistemas nativos locais (**ISPer** em Rust/Tauri 2 [01]) e fluxos de IA aplicada (**OptTime** com servidor MCP de 16 ferramentas [02] e pipelines RAG sobre pgvector) — com ${content.experience.projects.length} entregas corporativas em produção e ${content.profile.repoCount}+ repositórios públicos [DOC·03].`,
            ].join('\n\n')
          : [
              `**${content.profile.fullName}** (${content.profile.name}) is a Brazilian software engineer based in ${content.profile.location} and **${content.experience.role} at ${content.experience.company}** since June 2024 [DOC·01].`,
              `He builds full-stack software (TypeScript, React, Next.js, Node.js, C#, PostgreSQL), native local systems (**ISPer** in Rust/Tauri 2 [01]), and applied AI workflows (**OptTime** with a 16-tool MCP server [02] and pgvector RAG pipelines) — backed by ${content.experience.projects.length} production client deliveries and ${content.profile.repoCount}+ public repositories [DOC·03].`,
            ].join('\n\n'),
        citations: dedupeCitations(citations),
      }
    }

    case 'out_of_scope': {
      addNote('DOC·06')
      return {
        text: isPt
          ? 'Essa informação não está registrada no dossiê público do Marcus — e este console nunca inventa dados, valores ou experiências ausentes [DOC·06].\n\nSe for uma dúvida específica sobre contratação, escopo ou detalhes fora do portfólio, você pode enviar a pergunta direto para o inbox dele abaixo (ou testar `/fit`, `/stack`, `/projects` ou `/experience`).'
          : 'That detail is not recorded in Marcus’s public dossier — and this console never fabricates missing facts, rates, or credentials [DOC·06].\n\nIf this is a specific recruiting or project question, you can route it straight to Marcus’s inbox below (or explore `/fit`, `/stack`, `/projects`, or `/experience`).',
        citations: dedupeCitations(citations),
        approval: buildHandoffApproval(
          locale,
          isPt ? 'Pergunta fora do dossiê público' : 'Question outside public dossier',
          isPt
            ? `Olá Marcus, perguntei no seu dossiê mas não havia registro público:\n\n"${query}"`
            : `Hi Marcus, I asked your dossier but it wasn't in the public record:\n\n"${query}"`,
        ),
      }
    }

    case 'general':
    default: {
      const notes = searchKnowledge(query, locale).slice(0, 2)
      const projHits = searchProjects(query, content, signals).slice(0, 2)
      const engHits = searchEngagements(query, content, signals).slice(0, 2)
      for (const note of notes) addNote(note.id)
      for (const proj of projHits) citations.push(projectCitation(proj, locale))
      for (const eng of engHits) citations.push(engagementCitation(eng, engOrdinal(eng.id), locale))

      const parts: string[] = []
      for (const note of notes) {
        parts.push(`${note.body[locale]} [${note.id}]`)
      }
      if (projHits.length > 0) {
        parts.push(
          (isPt ? 'Projetos relacionados:\n' : 'Related projects:\n') +
            projHits
              .map((p) => `- **${p.title}** [${p.index}] — ${p.description[locale]}`)
              .join('\n'),
        )
      }
      if (engHits.length > 0) {
        parts.push(
          (isPt ? 'Entregas relacionadas:\n' : 'Related client engagements:\n') +
            engHits
              .map((e) => {
                const tag = `EXP·${String(engOrdinal(e.id)).padStart(2, '0')}`
                return `- **${e.client}** [${tag}] — ${e.scope[locale]}`
              })
              .join('\n'),
        )
      }

      if (parts.length === 0) {
        addNote('DOC·01')
        parts.push(
          isPt
            ? 'Posso consultar o stack completo (`/stack`), os 5 projetos em destaque (`/projects`), as 7 entregas corporativas na Optsolv (`/experience`), o Diário (`/posts`) ou analisar a descrição completa de uma vaga (`/fit`) [DOC·01].'
            : 'I can inspect the full stack (`/stack`), 5 featured projects (`/projects`), 7 production engagements at Optsolv (`/experience`), journal notes (`/posts`), or match a full job description (`/fit`) [DOC·01].',
        )
      }

      return {
        text: parts.join('\n\n'),
        citations: dedupeCitations(citations),
      }
    }
  }
}

const FOLLOW_UP_PATTERN =
  /\b(isso|disso|nisso|dele|dela|desse|dessa|nele|nela|nesse|nessa|mais detalhes|me conte mais|fale mais|aprofunde|e a stack|qual a stack|quais tecnologias|qual o link|como funciona|tell me more|more about|about it|about that|its stack|what stack|how does it|elaborate|go deeper)\b/i

/**
 * Resolves short conversational follow-ups ("tell me more about it", "qual a
 * stack dele?") by attaching the main entity from the most recent assistant
 * turn when the current query doesn't name an entity explicitly.
 */
export function resolveFollowUpInput(
  rawInput: string,
  history: AgentHistoryEntry[] | undefined,
  content: SiteContent,
): string {
  const trimmed = rawInput.trim()
  if (!trimmed || trimmed.startsWith('/') || !history || history.length === 0) {
    return trimmed
  }
  if (trimmed.length > 140) return trimmed

  const initial = classifyIntent(trimmed, content)
  const hasExplicitAnchor =
    initial.signals.matchedProjectTitles.length > 0 ||
    initial.signals.matchedClients.length > 0 ||
    initial.signals.matchedTechs.length > 0 ||
    initial.signals.externalTechs.length > 0

  if (hasExplicitAnchor || !FOLLOW_UP_PATTERN.test(initial.signals.normalized)) {
    return trimmed
  }

  const lastAssistant = [...history]
    .reverse()
    .find(
      (entry) =>
        entry.role === 'assistant' &&
        (entry.intent === 'projects' ||
          entry.intent === 'experience' ||
          entry.intent === 'ai_work') &&
        entry.citationTitles &&
        entry.citationTitles.length > 0,
    )

  const anchor = lastAssistant?.citationTitles?.[0]?.split(' — ')[0]?.trim()
  if (!anchor) return trimmed

  return `${trimmed} ${anchor}`
}

export interface GroundedTurnPlan {
  intent: AgentIntent
  query: string
  effectiveInput: string
  plannedTools: (() => ToolExecutionResult)[]
  composed: ComposedTurn
}

/**
 * Shared deterministic retrieval, tool plan, citations, FitReport, and
 * approval builder used by both `LocalDeterministicRuntime` and the Phase 2
 * `HybridEdgeRuntime`.
 */
export function prepareGroundedTurn(
  input: string,
  context: Pick<AgentRuntimeContext, 'content' | 'posts' | 'locale' | 'lens' | 'history'>,
): GroundedTurnPlan {
  const { content, posts, locale, lens, history } = context
  const effectiveInput = resolveFollowUpInput(input, history, content)
  const { intent, signals, slash } = classifyIntent(effectiveInput, content)
  const query = slash.rest || effectiveInput

  const plannedTools: (() => ToolExecutionResult)[] = []
  switch (intent) {
    case 'fit':
      plannedTools.push(
        () => runListTechnologies(content, signals, locale),
        () => runGetExperience(query, content, signals, locale),
        () => runListProjects(query, content, signals, locale),
        () => runMatchRole(effectiveInput, content, locale),
      )
      break
    case 'stack':
      plannedTools.push(
        () => runListTechnologies(content, signals, locale),
        () => runGetExperience(query, content, signals, locale),
        () => runListProjects(query, content, signals, locale),
      )
      break
    case 'projects':
      plannedTools.push(() => runListProjects(query, content, signals, locale))
      break
    case 'experience':
      plannedTools.push(() => runGetExperience(query, content, signals, locale))
      break
    case 'ai_work':
      plannedTools.push(
        () => runListProjects(query, content, signals, locale),
        () => runGetExperience(query, content, signals, locale),
      )
      break
    case 'posts':
      plannedTools.push(() => runListPosts(query, posts, signals, locale))
      break
    case 'cv':
    case 'availability':
    case 'profile':
      plannedTools.push(() => runGetProfile(content, locale))
      break
    case 'contact':
      plannedTools.push(
        () => runGetProfile(content, locale),
        () => runPrepareHandoff(query.slice(0, 60) || 'Contact', locale),
      )
      break
    case 'api':
      plannedTools.push(() => runGetProfile(content, locale))
      break
    case 'out_of_scope':
      plannedTools.push(
        () => runListTechnologies(content, signals, locale),
        () => runPrepareHandoff(query.slice(0, 60), locale),
      )
      break
    default:
      plannedTools.push(
        () => runListProjects(query, content, signals, locale),
        () => runGetExperience(query, content, signals, locale),
        () => runListPosts(query, posts, signals, locale),
      )
      break
  }

  const composed = composeResponse({
    intent,
    query,
    rawInput: effectiveInput,
    signals,
    content,
    posts,
    locale,
    lens,
  })

  return { intent, query, effectiveInput, plannedTools, composed }
}

export async function* streamTextLocally(
  text: string,
  fast: boolean,
  signal?: AbortSignal,
): AsyncGenerator<AgentEvent, void, void> {
  if (fast) {
    yield { type: 'text_delta', delta: text }
    return
  }
  const chunks = text.match(/\S+\s*/g) ?? [text]
  const stride = chunks.length > 60 ? 3 : 2
  for (let i = 0; i < chunks.length; i += stride) {
    if (signal?.aborted) return
    yield { type: 'text_delta', delta: chunks.slice(i, i + stride).join('') }
    await wait(16, signal)
  }
}

export async function* runPlannedTools(
  plannedTools: (() => ToolExecutionResult)[],
  locale: Locale,
  fast: boolean,
  signal?: AbortSignal,
): AsyncGenerator<AgentEvent, void, void> {
  const isPt = locale === 'pt'
  for (const runTool of plannedTools) {
    if (signal?.aborted) return
    const execution = runTool()
    const traceId = makeId('tool')
    yield {
      type: 'status',
      label: isPt ? `Executando ${execution.endpoint}…` : `Calling ${execution.endpoint}…`,
    }
    yield {
      type: 'tool_start',
      tool: {
        id: traceId,
        name: execution.name,
        endpoint: execution.endpoint,
        label: execution.label,
        args: execution.args,
        status: 'running',
        startedAt: Date.now(),
      },
    }
    if (!fast) await wait(130, signal)
    if (signal?.aborted) return
    yield {
      type: 'tool_result',
      id: traceId,
      durationMs: execution.durationMs,
      summary: execution.summary,
      result: execution.data,
    }
  }
}

export class LocalDeterministicRuntime implements AgentRuntime {
  readonly id = 'signal-dossier-local-v1'
  readonly mode = 'local-deterministic' as const

  async *streamTurn(
    input: string,
    context: AgentRuntimeContext,
  ): AsyncGenerator<AgentEvent, void, void> {
    const { locale, reducedMotion, instant, signal } = context
    const isPt = locale === 'pt'
    const fast = Boolean(reducedMotion || instant)

    const plan = prepareGroundedTurn(input, context)

    // 1. Execute tools and emit live trace events
    yield* runPlannedTools(plan.plannedTools, locale, fast, signal)
    if (signal?.aborted) return

    // 2. Emit grounded metadata & citations
    yield {
      type: 'status',
      label: isPt ? 'Verificando citações e evidências…' : 'Grounding citations & evidence…',
    }
    yield {
      type: 'runtime_meta',
      meta: { mode: 'local-deterministic' },
    }
    if (plan.composed.citations.length > 0) {
      yield { type: 'citations', citations: plan.composed.citations }
    }

    // 3. Stream text smoothly
    yield* streamTextLocally(plan.composed.text, fast, signal)
    if (signal?.aborted) return

    if (plan.composed.fitReport) {
      yield { type: 'fit_report', report: plan.composed.fitReport }
    }

    if (plan.composed.approval) {
      yield { type: 'approval_request', approval: plan.composed.approval }
    }

    yield { type: 'done', intent: plan.intent }
  }
}

export const defaultAgentRuntime = new LocalDeterministicRuntime()
