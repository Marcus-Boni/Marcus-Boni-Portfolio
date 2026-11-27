import type { Locale } from '@/i18n/translations'

import { normalizeText } from './retrieval'
import type { AgentLens, AgentTurn } from './types'

/**
 * Deterministic, zero-token contextual follow-up generator.
 *
 * Inspects the latest completed assistant turn (`intent`, `citations`,
 * `fitReport`) plus the active lens (`recruiter` / `engineer` / `client`) and
 * returns 2–3 relevant next questions while filtering out prompts already asked
 * in the current thread.
 */
export function buildContextualFollowups(
  lastTurn: AgentTurn | undefined,
  turns: readonly AgentTurn[],
  locale: Locale,
  lens: AgentLens,
): string[] {
  if (!lastTurn || lastTurn.role !== 'assistant' || lastTurn.streaming || lastTurn.stopped) {
    return []
  }

  const isPt = locale === 'pt'
  const candidates: string[] = []
  const citedTitles = lastTurn.citations.map((c) => normalizeText(c.title))
  const hasIsper = citedTitles.some((title) => title.includes('isper'))
  const hasOptTime = citedTitles.some((title) => title.includes('opttime'))

  switch (lastTurn.intent) {
    case 'fit':
      candidates.push(
        isPt ? 'Entregas em produção na Optsolv' : 'Production deliveries at Optsolv',
        isPt ? 'Disponibilidade e formatos de atuação' : 'Availability and engagement formats',
        isPt ? 'Baixar currículo PDF' : 'Download PDF résumé',
      )
      break

    case 'projects':
    case 'ai_work':
      if (hasIsper) {
        candidates.push(
          isPt
            ? 'Como o ISPer combina Rust, Tauri 2 e whisper.cpp?'
            : 'How does ISPer combine Rust, Tauri 2, and whisper.cpp?',
        )
      }
      if (hasOptTime) {
        candidates.push(
          isPt
            ? 'Como funciona o servidor MCP de 16 ferramentas do OptTime?'
            : 'How does OptTime’s 16-tool MCP server work?',
        )
      }
      candidates.push(
        isPt ? 'Últimas releases e atividade no GitHub' : 'Latest GitHub releases and activity',
        isPt ? 'Entregas corporativas na Optsolv' : 'Enterprise client deliveries at Optsolv',
        isPt ? 'Disponibilidade e idiomas' : 'Availability and languages',
      )
      break

    case 'activity':
      candidates.push(
        isPt ? 'Projetos de IA aplicada, MCP e RAG' : 'Applied AI, MCP, and RAG projects',
        isPt ? 'Stack completo em produção' : 'Full production tech stack',
        isPt ? 'Entregas em clientes na Optsolv' : 'Client deliveries at Optsolv',
      )
      break

    case 'experience':
      candidates.push(
        isPt ? 'Stack técnico usado em produção' : 'Production tech stack',
        isPt ? 'Últimas releases no GitHub' : 'Latest GitHub releases',
        lens === 'client'
          ? isPt
            ? '/contact Quero conversar sobre um projeto'
            : '/contact I would like to discuss a project'
          : isPt
            ? 'Disponibilidade e formatos de contrato'
            : 'Availability and contract formats',
      )
      break

    case 'stack':
      candidates.push(
        isPt ? 'Projetos públicos que comprovam esse stack' : 'Public projects proving this stack',
        isPt ? 'Entregas em produção na Optsolv' : 'Production deliveries at Optsolv',
        isPt ? 'Últimas releases no GitHub' : 'Latest GitHub releases',
      )
      break

    case 'posts':
      candidates.push(
        isPt ? 'Projetos públicos relacionados a esses temas' : 'Public projects related to these topics',
        isPt ? 'Últimas releases no GitHub' : 'Latest GitHub releases',
        isPt ? 'Como funciona a arquitetura OpenAPI 3.1 daqui?' : 'How does this site’s OpenAPI 3.1 work?',
      )
      break

    case 'availability':
      candidates.push(
        isPt ? 'Baixar currículo PDF' : 'Download PDF résumé',
        isPt ? 'Entregas na Optsolv por setor' : 'Optsolv deliveries by industry',
        isPt ? 'Stack em produção e IA aplicada' : 'Production stack and applied AI',
      )
      break

    case 'api':
      candidates.push(
        isPt ? 'Projetos de IA aplicada e servidores MCP' : 'Applied AI projects and MCP servers',
        isPt ? 'Últimas releases no GitHub' : 'Latest GitHub releases',
        isPt ? 'Artigos publicados no Diário técnico' : 'Published technical journal notes',
      )
      break

    case 'out_of_scope':
      candidates.push(
        isPt ? 'Stack em produção e IA aplicada' : 'Production stack and applied AI',
        isPt ? 'Entregas em clientes na Optsolv' : 'Client deliveries at Optsolv',
        isPt ? 'Disponibilidade e formatos' : 'Availability and formats',
      )
      break

    default:
      candidates.push(
        isPt ? 'Últimas releases no GitHub' : 'Latest GitHub releases',
        isPt ? 'Entregas na Optsolv' : 'Optsolv client deliveries',
        isPt ? 'Disponibilidade e currículo PDF' : 'Availability and PDF résumé',
      )
      break
  }

  // Exclude prompts that closely overlap with anything already asked in this thread
  const asked = new Set(
    turns
      .filter((turn) => turn.role === 'user')
      .map((turn) => normalizeText(turn.text)),
  )

  const seen = new Set<string>()
  const picked: string[] = []
  for (const prompt of candidates) {
    const norm = normalizeText(prompt)
    if (!norm || seen.has(norm) || asked.has(norm)) continue
    seen.add(norm)
    picked.push(prompt)
    if (picked.length >= 3) break
  }

  return picked
}
