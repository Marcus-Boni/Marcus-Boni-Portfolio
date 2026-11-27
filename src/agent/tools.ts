import type { PostMeta } from '@/blog/types'
import type { SiteContent } from '@/content/types'
import { cvFiles } from '@/data/profile'
import type { Locale } from '@/i18n/translations'

import type { IndexedPostSection } from './post-index'
import {
  analyzeJobFit,
  searchEngagements,
  searchPosts,
  searchPostSections,
  searchProjects,
  searchTechnologies,
  type QuerySignals,
} from './retrieval'
import type { ToolName } from './types'

/**
 * Executable tool registry mirroring the site's OpenAPI 3.1 `operationId`s
 * (`src/data/api.ts`) plus two local console tools (`matchRole`, `prepareHandoff`).
 *
 * Every tool measures its real wall-clock execution time and returns a clean,
 * inspectable JSON payload that CTOs and recruiters can expand directly inside
 * the `ToolCallsTrace` component.
 */

export interface ToolExecutionResult<T = unknown> {
  name: ToolName
  endpoint: string
  label: string
  args: Record<string, unknown>
  durationMs: number
  summary: string
  data: T
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function measure<T>(
  meta: { name: ToolName; endpoint: string; label: string; args: Record<string, unknown> },
  run: () => { data: T; summary: string },
): ToolExecutionResult<T> {
  const start = nowMs()
  const { data, summary } = run()
  const elapsed = Math.max(1, Math.round(nowMs() - start))
  return { ...meta, durationMs: elapsed, summary, data }
}

export function runGetProfile(content: SiteContent, locale: Locale) {
  const { profile, experience, socials } = content
  return measure(
    {
      name: 'getProfile',
      endpoint: 'GET /api/v1/profile',
      label: locale === 'pt' ? 'Consultar perfil e disponibilidade' : 'Read profile & availability',
      args: { locale },
    },
    () => ({
      data: {
        name: profile.name,
        fullName: profile.fullName,
        role: profile.role,
        employer: {
          company: experience.company,
          role: experience.role,
          since: experience.start,
          current: experience.end === null,
        },
        location: profile.location,
        available: profile.available,
        repositoryCount: profile.repoCount,
        email: profile.email,
        links: socials.map(({ label, url }) => ({ label, url })),
        resumes: cvFiles,
      },
      summary:
        locale === 'pt'
          ? `${profile.name} · ${experience.company} · ${profile.repoCount}+ repos`
          : `${profile.name} · ${experience.company} · ${profile.repoCount}+ repos`,
    }),
  )
}

export function runListTechnologies(
  content: SiteContent,
  signals: QuerySignals,
  locale: Locale,
) {
  return measure(
    {
      name: 'listTechnologies',
      endpoint: 'GET /api/v1/stack',
      label: locale === 'pt' ? 'Verificar stack técnico' : 'Query technical stack',
      args:
        signals.matchedTechs.length > 0
          ? { filter: signals.matchedTechs }
          : { scope: 'all' },
    },
    () => {
      const items = searchTechnologies(content, signals)
      const byCategory = {
        frontend: items.filter((item) => item.category === 'frontend').map((item) => item.name),
        backend: items.filter((item) => item.category === 'backend').map((item) => item.name),
        data: items.filter((item) => item.category === 'data').map((item) => item.name),
        ops: items.filter((item) => item.category === 'ops').map((item) => item.name),
      }
      return {
        data: {
          totalInStack: content.techStack.length,
          matchedCount: items.length,
          unlistedRequested: signals.externalTechs.map((entry) => entry.name),
          byCategory,
        },
        summary:
          signals.matchedTechs.length > 0
            ? locale === 'pt'
              ? `${items.length} correspondências no stack (${content.techStack.length} no total)`
              : `${items.length} stack matches (${content.techStack.length} total)`
            : locale === 'pt'
              ? `${content.techStack.length} tecnologias em 4 camadas`
              : `${content.techStack.length} technologies across 4 layers`,
      }
    },
  )
}

export function runListProjects(
  query: string,
  content: SiteContent,
  signals: QuerySignals,
  locale: Locale,
) {
  return measure(
    {
      name: 'listProjects',
      endpoint: 'GET /api/v1/projects',
      label: locale === 'pt' ? 'Buscar projetos públicos' : 'Search public projects',
      args: query ? { query: query.slice(0, 80) } : { scope: 'featured' },
    },
    () => {
      const items = searchProjects(query, content, signals)
      const list = items.length > 0 ? items : content.projects
      return {
        data: {
          matched: items.length,
          total: content.projects.length,
          items: list.map((project) => ({
            id: project.index,
            title: project.title,
            year: project.year,
            stack: project.stack,
            url: project.url,
          })),
        },
        summary:
          items.length > 0
            ? locale === 'pt'
              ? `${items.length} projeto(s): ${items.map((p) => p.title).join(', ')}`
              : `${items.length} project(s): ${items.map((p) => p.title).join(', ')}`
            : locale === 'pt'
              ? `${content.projects.length} projetos selecionados`
              : `${content.projects.length} selected projects`,
      }
    },
  )
}

export function runGetExperience(
  query: string,
  content: SiteContent,
  signals: QuerySignals,
  locale: Locale,
) {
  return measure(
    {
      name: 'getExperience',
      endpoint: 'GET /api/v1/experience',
      label: locale === 'pt' ? 'Consultar entregas em clientes' : 'Inspect client engagements',
      args: query ? { query: query.slice(0, 80) } : { company: content.experience.company },
    },
    () => {
      const items = searchEngagements(query, content, signals)
      const list = items.length > 0 ? items : content.experience.projects
      return {
        data: {
          company: content.experience.company,
          role: content.experience.role,
          since: content.experience.start,
          matched: items.length,
          total: content.experience.projects.length,
          engagements: list.map((eng) => ({
            id: eng.id,
            client: eng.client,
            sector: eng.sector[locale],
            title: eng.title[locale],
            stack: eng.stack,
          })),
        },
        summary:
          items.length > 0
            ? locale === 'pt'
              ? `${items.length} entrega(s): ${items.slice(0, 3).map((e) => e.client.split(' - ')[0]).join(', ')}`
              : `${items.length} engagement(s): ${items.slice(0, 3).map((e) => e.client.split(' - ')[0]).join(', ')}`
            : locale === 'pt'
              ? `${content.experience.projects.length} entregas na ${content.experience.company}`
              : `${content.experience.projects.length} deliveries at ${content.experience.company}`,
      }
    },
  )
}

export function runListPosts(
  query: string,
  posts: PostMeta[],
  signals: QuerySignals,
  locale: Locale,
  postSections?: readonly IndexedPostSection[],
) {
  return measure(
    {
      name: 'listPosts',
      endpoint: 'GET /api/v1/posts',
      label: locale === 'pt' ? 'Buscar registros do Diário' : 'Query journal entries',
      args: query ? { query: query.slice(0, 80) } : { status: 'published' },
    },
    () => {
      const items = searchPosts(query, posts, signals)
      const matchedSections =
        postSections && postSections.length > 0 && query.trim()
          ? searchPostSections(query, postSections, signals, locale)
          : []
      const uniqueSlugs = new Set(matchedSections.map((sec) => sec.slug))
      return {
        data: {
          publishedCount: posts.length,
          indexedSections: postSections?.length ?? 0,
          matchedCount: items.length,
          matchedSections: matchedSections.map((sec) => ({
            slug: sec.slug,
            title: sec.postTitle,
            heading: sec.headingText || null,
            anchor: sec.headingId ? `#${sec.headingId}` : null,
            href: sec.href,
          })),
          items: items.map((post) => {
            const loc = post.locales?.[locale]
            return {
              slug: post.slug,
              title: loc?.title || post.title,
              tags: loc?.tags ?? post.tags,
              readingMinutes: loc?.readingMinutes ?? post.readingMinutes,
              publishedAt: post.publishedAt,
            }
          }),
        },
        summary:
          posts.length === 0
            ? locale === 'pt'
              ? 'Nenhum registro publicado carregado'
              : 'No published entries loaded'
            : matchedSections.length > 0
              ? locale === 'pt'
                ? `${matchedSections.length} seção(ões) em ${uniqueSlugs.size} artigo(s) (de ${posts.length} publicados)`
                : `${matchedSections.length} section(s) across ${uniqueSlugs.size} article(s) (of ${posts.length} published)`
              : locale === 'pt'
                ? `${items.length} registro(s) de ${posts.length} publicados`
                : `${items.length} of ${posts.length} published entries`,
      }
    },
  )
}

export function runMatchRole(
  rawInput: string,
  content: SiteContent,
  locale: Locale,
) {
  return measure(
    {
      name: 'matchRole',
      endpoint: 'LOCAL /agent/fit',
      label: locale === 'pt' ? 'Cruzar requisitos da vaga com evidências' : 'Cross-check role requirements against evidence',
      args: { characters: rawInput.length, locale },
    },
    () => {
      const report = analyzeJobFit(rawInput, content, locale)
      return {
        data: {
          roleHint: report.roleHint,
          verifiedRequirements: report.matched.map((item) => item.skill),
          unlistedRequirements: report.gaps.map((gap) => gap.term),
          relevantProjects: report.relevantProjects.map((p) => p.title),
          relevantClients: report.relevantEngagements.map((e) => e.client),
        },
        summary:
          locale === 'pt'
            ? `${report.matched.length} requisito(s) comprovado(s) · ${report.gaps.length} fora do dossiê`
            : `${report.matched.length} verified requirement(s) · ${report.gaps.length} unlisted`,
      }
    },
  )
}

export function runPrepareHandoff(
  subject: string,
  locale: Locale,
) {
  return measure(
    {
      name: 'prepareHandoff',
      endpoint: 'ACTION /inbox/draft',
      label: locale === 'pt' ? 'Preparar envio com aprovação' : 'Prepare approval-gated handoff',
      args: { channel: 'firestore-inbox', requiresApproval: true },
    },
    () => ({
      data: {
        channel: 'firestore-inbox',
        fallbackChannel: 'mailto:mgalvaoboni@gmail.com',
        requiresHumanApproval: true,
        subject,
      },
      summary:
        locale === 'pt'
          ? 'Rascunho pronto — aguardando confirmação'
          : 'Draft ready — awaiting your approval',
    }),
  )
}
