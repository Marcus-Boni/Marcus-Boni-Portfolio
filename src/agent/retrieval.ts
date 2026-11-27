import type { PostMeta } from '@/blog/types'
import type {
  ExperienceProject,
  Project,
  SiteContent,
  TechItem,
} from '@/content/types'
import type { Locale } from '@/i18n/translations'

import { activeKnowledgeNotes } from './dossier-cms'
import {
  DOMAIN_ONTOLOGY,
  EXTERNAL_TECH_CATALOG,
  TECH_ONTOLOGY,
  type KnowledgeNote,
} from './knowledge'
import type { IndexedPostSection } from './post-index'
import type { AgentIntent, FitEvidenceItem, FitGapItem, FitReport } from './types'

/**
 * Pure algorithmic retrieval, intent routing, fuzzy matching, and Job Description
 * fit analysis. Zero DOM, zero React, zero network — fully exercised by
 * `tests/agent-eval.test.ts`.
 */

const STOPWORDS = new Set([
  // Portuguese
  'a', 'o', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das',
  'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'pra', 'com', 'sem', 'sob', 'sobre',
  'entre', 'ate', 'que', 'qual', 'quais', 'quem', 'como', 'onde', 'quando', 'quanto',
  'porque', 'porquê', 'e', 'ou', 'mas', 'se', 'ja', 'já', 'mais', 'menos', 'muito',
  'ele', 'ela', 'voce', 'você', 'marcus', 'boni', 'me', 'te', 'nos', 'seu', 'sua',
  'seus', 'suas', 'tem', 'têm', 'ter', 'foi', 'ser', 'sao', 'são', 'esta', 'está',
  'esse', 'essa', 'este', 'esta', 'isso', 'isto', 'aqui', 'la', 'lá', 'algum',
  'alguma', 'alguns', 'falar', 'saber', 'mostrar', 'mostre', 'diga', 'conta', 'conte',
  'trabalha', 'trabalhou', 'trabalhar', 'fez', 'faz', 'experiencia', 'experiência',
  // English
  'the', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'from', 'about', 'into', 'over', 'after', 'is', 'are', 'was', 'were', 'be', 'been',
  'has', 'have', 'had', 'do', 'does', 'did', 'can', 'could', 'would', 'should', 'will',
  'what', 'which', 'who', 'where', 'when', 'how', 'why', 'this', 'that', 'these',
  'those', 'he', 'his', 'him', 'you', 'your', 'me', 'my', 'we', 'our', 'tell', 'show',
  'give', 'any', 'some', 'work', 'worked', 'working', 'experience', 'using', 'used',
])

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[’'`]/g, "'")
    .trim()
}

/** Keeps tech symbols like `c#`, `c++`, `.net`, `next.js`, `ci/cd`. */
export function tokenize(value: string): string[] {
  const norm = normalizeText(value)
  const raw = norm.match(/[a-z0-9][a-z0-9.#/+_-]*/g) ?? []
  return raw
    .map((token) => token.replace(/^[._/-]+|[._/-]+$/g, ''))
    .filter((token) => token.length > 0 && !STOPWORDS.has(token))
}

function trigrams(word: string): Set<string> {
  const padded = `  ${word} `
  const out = new Set<string>()
  for (let i = 0; i <= padded.length - 3; i += 1) {
    out.add(padded.slice(i, i + 3))
  }
  return out
}

export function trigramSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 3 || b.length < 3) return 0
  const ta = trigrams(a)
  const tb = trigrams(b)
  let shared = 0
  for (const gram of ta) {
    if (tb.has(gram)) shared += 1
  }
  return (2 * shared) / (ta.size + tb.size)
}

/** Checks word-boundary presence of an alias inside normalized prose. */
function containsPhrase(normalizedHaystack: string, alias: string): boolean {
  const normAlias = normalizeText(alias)
  if (!normAlias) return false
  const escaped = normAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const boundaryLeft = /^[a-z0-9]/.test(normAlias) ? '(?:^|[^a-z0-9+#])' : ''
  const boundaryRight = /[a-z0-9]$/.test(normAlias) ? '(?:$|[^a-z0-9+#])' : ''
  return new RegExp(`${boundaryLeft}${escaped}${boundaryRight}`, 'i').test(normalizedHaystack)
}

export interface ParsedSlashCommand {
  command: string | null
  rest: string
}

export function parseSlashCommand(input: string): ParsedSlashCommand {
  const trimmed = input.trim()
  const match = trimmed.match(/^(\/[a-z]+)(?:\s+([\s\S]*))?$/i)
  if (!match) return { command: null, rest: trimmed }
  return { command: match[1].toLowerCase(), rest: (match[2] ?? '').trim() }
}

export interface QuerySignals {
  normalized: string
  tokens: string[]
  matchedTechs: string[]
  matchedDomains: string[]
  externalTechs: { name: string; adjacent: readonly string[] }[]
  matchedProjectTitles: string[]
  matchedClients: string[]
}

export function extractQuerySignals(input: string, content: SiteContent): QuerySignals {
  const normalized = normalizeText(input)
  const tokens = tokenize(input)

  const techSet = new Set<string>()
  const knownStackNames = content.techStack.map((item) => item.name)

  // 1. Direct & ontology matches against live CMS stack
  for (const techName of knownStackNames) {
    const aliases = TECH_ONTOLOGY[techName] ?? [techName]
    const allTerms = [techName, ...aliases]
    const directHit = allTerms.some((alias) => containsPhrase(normalized, alias))
    if (directHit) {
      techSet.add(techName)
      continue
    }
    // Fuzzy typo match on individual tokens (e.g. "postgress", "taury", "fluter")
    const normTech = normalizeText(techName)
    if (normTech.length >= 4) {
      for (const token of tokens) {
        if (token.length >= 4 && trigramSimilarity(token, normTech) >= 0.62) {
          techSet.add(techName)
          break
        }
      }
    }
  }

  // Also check extra stack terms inside projects/experience not explicitly in techStack (e.g. Sankhya, N8N, CopilotKit, whisper.cpp, CUDA, PWA)
  const extraEvidenceTerms: { canonical: string; aliases: string[] }[] = [
    { canonical: 'whisper.cpp', aliases: ['whisper.cpp', 'whisper'] },
    { canonical: 'CUDA', aliases: ['cuda', 'gpu'] },
    { canonical: 'CopilotKit', aliases: ['copilotkit'] },
    { canonical: 'RAG', aliases: ['rag', 'retrieval augmented', 'retrieval-augmented'] },
    { canonical: 'N8N', aliases: ['n8n'] },
    { canonical: 'Sankhya ERP', aliases: ['sankhya', 'sankia', 'erp'] },
    { canonical: 'PWA', aliases: ['pwa', 'progressive web'] },
    { canonical: 'REST APIs', aliases: ['rest', 'rest api', 'rest apis', 'restful'] },
    { canonical: 'WebService', aliases: ['webservice', 'web service', 'soap'] },
    { canonical: 'AD Auth', aliases: ['active directory', 'ad auth'] },
  ]
  for (const entry of extraEvidenceTerms) {
    if (entry.aliases.some((alias) => containsPhrase(normalized, alias))) {
      techSet.add(entry.canonical)
    } else if (entry.canonical.length >= 5) {
      const normCanon = normalizeText(entry.canonical)
      for (const token of tokens) {
        if (token.length >= 5 && trigramSimilarity(token, normCanon) >= 0.62) {
          techSet.add(entry.canonical)
          break
        }
      }
    }
  }

  // 2. Domain matches
  const matchedDomains: string[] = []
  for (const [domain, aliases] of Object.entries(DOMAIN_ONTOLOGY)) {
    if (aliases.some((alias) => containsPhrase(normalized, alias))) {
      matchedDomains.push(domain)
    }
  }

  // 3. External/unrecorded technologies (for honest gap detection)
  const externalTechs: { name: string; adjacent: readonly string[] }[] = []
  for (const entry of EXTERNAL_TECH_CATALOG) {
    const hit =
      entry.aliases.some((alias) => containsPhrase(normalized, alias)) ||
      tokens.some(
        (token) =>
          token.length >= 5 &&
          entry.aliases.some((alias) => alias.length >= 5 && trigramSimilarity(token, normalizeText(alias)) >= 0.66),
      )
    if (hit) {
      externalTechs.push({ name: entry.name, adjacent: entry.adjacent })
    }
  }

  // 4. Direct project & client name mentions
  const matchedProjectTitles: string[] = []
  for (const project of content.projects) {
    const normTitle = normalizeText(project.title)
    if (
      containsPhrase(normalized, normTitle) ||
      tokens.some((token) => token.length >= 4 && trigramSimilarity(token, normTitle) >= 0.68)
    ) {
      matchedProjectTitles.push(project.title)
    }
  }

  const matchedClients: string[] = []
  for (const eng of content.experience.projects) {
    const shortNames = [eng.client, eng.id, eng.client.split(' - ')[0], eng.title.pt, eng.title.en]
    const hit = shortNames.some(
      (name) =>
        name.length >= 3 &&
        (containsPhrase(normalized, name) ||
          tokens.some((token) => token.length >= 5 && trigramSimilarity(token, normalizeText(name)) >= 0.68)),
    )
    if (hit) matchedClients.push(eng.client)
  }

  return {
    normalized,
    tokens,
    matchedTechs: [...techSet],
    matchedDomains,
    externalTechs,
    matchedProjectTitles,
    matchedClients,
  }
}

/** Detects when a recruiter pasted a Job Description directly without typing `/fit`. */
export function looksLikeJobDescription(input: string, signals: QuerySignals): boolean {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const bulletLines = lines.filter((line) => /^[-•*✓▪]/.test(line)).length
  const totalTechSignals = signals.matchedTechs.length + signals.externalTechs.length
  const hasJdKeywords =
    /\b(requisitos|requirements|responsabilidades|responsibilities|qualifications|diferenciais|nice to have|must have|job description|descricao da vaga|vaga|senior|pleno|staff|full[- ]?stack engineer|software engineer|beneficios|benefits)\b/i.test(
      signals.normalized,
    )

  if (bulletLines >= 2 && totalTechSignals >= 2) return true
  if (input.length >= 220 && totalTechSignals >= 3 && hasJdKeywords) return true
  if (lines.length >= 4 && totalTechSignals >= 4) return true
  return false
}

const OUT_OF_SCOPE_PATTERNS = [
  /\b(receita|bolo|pizza|futebol|clima|previsao do tempo|weather|recipe|joke|piada|horoscopo|politica|eleicao|bitcoin price|stock price|cotacao|translate this|traduza este texto|escreva um poema|write a poem)\b/i,
  /\b(salario|salário|pretensao|pretensão|salary|compensation|rate card|valor hora|hourly rate|cpf|rg|endereco residencial|home address|telefone pessoal|whatsapp|numero de telefone|phone number|idade da mae)\b/i,
]

export interface ClassifyIntentOptions {
  knowledgeNotes?: readonly KnowledgeNote[]
  postSections?: readonly IndexedPostSection[]
  locale?: Locale
}

export function classifyIntent(
  input: string,
  content: SiteContent,
  options?: ClassifyIntentOptions,
): { intent: AgentIntent; signals: QuerySignals; slash: ParsedSlashCommand } {
  const slash = parseSlashCommand(input)
  const body = slash.rest || input
  const signals = extractQuerySignals(body, content)
  const norm = signals.normalized

  // 1. Explicit slash commands win immediately
  if (slash.command === '/fit') return { intent: 'fit', signals, slash }
  if (slash.command === '/stack') return { intent: 'stack', signals, slash }
  if (slash.command === '/projects') return { intent: 'projects', signals, slash }
  if (slash.command === '/experience') return { intent: 'experience', signals, slash }
  if (slash.command === '/posts') return { intent: 'posts', signals, slash }
  if (slash.command === '/cv' || slash.command === '/resume') return { intent: 'cv', signals, slash }
  if (slash.command === '/contact' || slash.command === '/handoff') return { intent: 'contact', signals, slash }
  if (slash.command === '/api') return { intent: 'api', signals, slash }

  // 2. Automatic pasted Job Description detection
  if (looksLikeJobDescription(body, signals)) {
    return { intent: 'fit', signals, slash }
  }

  // 3. Explicit CV / resume download request
  if (/\b(cv|curriculo|currículo|resume|résumé|pdf)\b/i.test(norm)) {
    return { intent: 'cv', signals, slash }
  }

  // 4. Explicit API / how this agent works inquiry
  if (
    /\b(openapi|llms\.txt|accept:\s*text\/markdown|developers|como funciona|how does this|how do this|motor deterministico|deterministic|api\/v1|endpoints)\b/i.test(
      norm,
    )
  ) {
    return { intent: 'api', signals, slash }
  }

  // 5. Direct contact / handoff intent
  if (
    /\b(entrar em contato|falar com|enviar mensagem|mandar mensagem|quero contratar|orcamento|orçamento|proposta|contact|reach out|send a message|get in touch|email|e-mail|hire|conversar sobre um projeto|conversar sobre uma vaga)\b/i.test(
      norm,
    ) &&
    signals.matchedTechs.length === 0
  ) {
    return { intent: 'contact', signals, slash }
  }

  // 6. Availability, languages, location, work model
  if (
    /\b(disponibilidade|disponivel|available|availability|remoto|remote|hibrido|hybrid|pj|clt|freelance|full-time|ingles|english|idioma|idiomas|language|languages|fuso|timezone|onde mora|location|localizacao)\b/i.test(
      norm,
    ) &&
    signals.matchedProjectTitles.length === 0 &&
    signals.matchedClients.length === 0
  ) {
    return { intent: 'availability', signals, slash }
  }

  // 7. Blog / journal posts
  if (/\b(blog|diario|diário|artigo|artigos|post|posts|escreveu|escreve|journal|articles|writing|notas de campo|field notes)\b/i.test(norm)) {
    return { intent: 'posts', signals, slash }
  }

  // 8. Client work / experience / sectors
  const explicitExperience =
    signals.matchedClients.length > 0 ||
    /\b(optsolv|cliente|clientes|client|clients|empresa|empresas|setor|setores|sector|sectors|industries|trajetoria|trajetória|carreira|career|engagements)\b/i.test(
      norm,
    )
  const weakProductionCue =
    /\b(entregas|producao|produção)\b/i.test(norm) && signals.matchedTechs.length === 0
  if (explicitExperience) {
    return { intent: 'experience', signals, slash }
  }
  if (weakProductionCue) {
    const strongBlogSection =
      options?.postSections && options.postSections.length > 0
        ? searchPostSectionsScored(body, options.postSections, signals, options.locale ?? 'pt')
        : []
    if (strongBlogSection.length > 0 && strongBlogSection[0].score >= 8) {
      return { intent: 'posts', signals, slash }
    }
    return { intent: 'experience', signals, slash }
  }

  // 9. Specific projects or portfolio works
  if (
    signals.matchedProjectTitles.length > 0 ||
    /\b(projeto|projetos|project|projects|repo|repos|repositorio|repositórios|github|portfolio|portfólio)\b/i.test(
      norm,
    )
  ) {
    return { intent: 'projects', signals, slash }
  }

  // 10. Applied AI focus (only when the query isn't asking about non-AI stack items like PostgreSQL/React)
  const AI_ONLY_TECHS = new Set(['MCP', 'pgvector', 'RAG', 'CopilotKit', 'N8N', 'whisper.cpp'])
  const hasNonAiTech = signals.matchedTechs.some((tech) => !AI_ONLY_TECHS.has(tech))
  if (
    signals.matchedDomains.includes('Applied AI & RAG') &&
    !hasNonAiTech &&
    signals.externalTechs.length === 0
  ) {
    return { intent: 'ai_work', signals, slash }
  }

  // 11. Stack / technology check (including questions about unlisted techs like Kubernetes!)
  if (
    signals.matchedTechs.length > 0 ||
    signals.externalTechs.length > 0 ||
    /\b(stack|tecnologia|tecnologias|ferramenta|ferramentas|linguagem|linguagens|tech|technologies|tools|skills)\b/i.test(
      norm,
    )
  ) {
    return { intent: 'stack', signals, slash }
  }

  // 12. Out-of-scope / private info guard (salary, phone, recipes, unrelated trivia)
  if (OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(norm))) {
    return { intent: 'out_of_scope', signals, slash }
  }

  // 13. Who is Marcus / general profile overview
  if (
    /\b(quem e|quem é|sobre|perfil|resumo|bio|who is|about|profile|summary|overview|introducao|apresentacao|diferencial|diferenciais)\b/i.test(
      norm,
    )
  ) {
    return { intent: 'profile', signals, slash }
  }

  // 14. Anything else with zero domain overlap → check live CMS notes & indexed blog sections
  const noteHitsPt = searchKnowledge(body, 'pt', options?.knowledgeNotes)
  const noteHitsEn = searchKnowledge(body, 'en', options?.knowledgeNotes)
  const hasNoteHit = noteHitsPt.length > 0 || noteHitsEn.length > 0

  if (!hasNoteHit && options?.postSections && options.postSections.length > 0) {
    const sectionHits = searchPostSectionsScored(
      body,
      options.postSections,
      signals,
      options.locale ?? 'pt',
    )
    if (sectionHits.length > 0 && sectionHits[0].score >= 6) {
      return { intent: 'posts', signals, slash }
    }
  }

  if (signals.matchedDomains.length === 0 && !hasNoteHit && signals.tokens.length >= 2) {
    return { intent: 'out_of_scope', signals, slash }
  }

  return { intent: 'general', signals, slash }
}

/** Weighted token + fuzzy BM25-like relevance scorer over any document string. */
function scoreDocument(queryTokens: string[], matchedTerms: string[], docText: string): number {
  const normDoc = normalizeText(docText)
  let score = 0

  for (const term of matchedTerms) {
    if (containsPhrase(normDoc, term)) score += 6
  }

  const docWords = normDoc.match(/[a-z0-9][a-z0-9.#/+_-]*/g) ?? []
  const docWordSet = new Set(docWords)

  for (const token of queryTokens) {
    if (docWordSet.has(token)) {
      score += 3
    } else if (normDoc.includes(token) && token.length >= 3) {
      score += 2
    } else if (token.length >= 4) {
      for (const word of docWordSet) {
        if (word.length >= 4 && trigramSimilarity(token, word) >= 0.66) {
          score += 1.5
          break
        }
      }
    }
  }

  return score
}

export function searchProjects(
  query: string,
  content: SiteContent,
  signals: QuerySignals,
): Project[] {
  const scored = content.projects
    .map((project) => {
      const text = `${project.title} ${project.description.pt} ${project.description.en} ${project.stack.join(' ')} ${project.year}`
      let score = scoreDocument(signals.tokens, signals.matchedTechs, text)
      if (signals.matchedProjectTitles.includes(project.title)) score += 15
      if (signals.matchedDomains.includes('Applied AI & RAG') && /MCP|RAG|AI|whisper|Copilot/i.test(text)) {
        score += 5
      }
      if (signals.matchedDomains.includes('Desktop & Local Systems') && /Rust|Tauri|whisper/i.test(text)) {
        score += 5
      }
      return { project, score }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0 && !query.trim()) return [...content.projects]
  return scored.map((entry) => entry.project)
}

export function searchEngagements(
  query: string,
  content: SiteContent,
  signals: QuerySignals,
): ExperienceProject[] {
  const scored = content.experience.projects
    .map((entry) => {
      const text = `${entry.client} ${entry.title.pt} ${entry.title.en} ${entry.sector.pt} ${entry.sector.en} ${entry.scope.pt} ${entry.scope.en} ${entry.stack.join(' ')}`
      let score = scoreDocument(signals.tokens, signals.matchedTechs, text)
      if (signals.matchedClients.includes(entry.client)) score += 15
      if (signals.matchedDomains.includes('Applied AI & RAG') && /\bAI\b|\bIA\b|N8N/i.test(text)) score += 5
      if (signals.matchedDomains.includes('Enterprise & ERP Integration') && /ERP|Sankhya|AD|IIS|WebService|B2B|legad/i.test(text)) score += 4
      if (signals.matchedDomains.includes('Healthcare (Unimed)') && entry.id === 'unimed') score += 8
      if (signals.matchedDomains.includes('Logistics & Supply') && (entry.id === 'gab' || entry.id === 'cedisa')) score += 8
      if (signals.matchedDomains.includes('Industry & Environment') && (entry.id === 'hidrauvit' || entry.id === 'marca-ambiental')) score += 8
      if (signals.matchedDomains.includes('Real Estate & Finance') && entry.id === 'galwan') score += 8
      return { entry, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0 && !query.trim()) return [...content.experience.projects]
  return scored.map((item) => item.entry)
}

export function searchTechnologies(
  content: SiteContent,
  signals: QuerySignals,
): TechItem[] {
  if (signals.matchedTechs.length === 0) return [...content.techStack]
  const wanted = new Set(signals.matchedTechs.map((t) => normalizeText(t)))
  return content.techStack.filter((item) => wanted.has(normalizeText(item.name)))
}

export function searchPosts(
  query: string,
  posts: PostMeta[],
  signals: QuerySignals,
): PostMeta[] {
  if (posts.length === 0) return []
  const scored = posts
    .map((post) => {
      const pt = post.locales?.pt
      const en = post.locales?.en
      const text = [
        post.slug,
        post.title,
        post.subtitle,
        post.excerpt,
        ...post.tags,
        pt?.title ?? '',
        pt?.excerpt ?? '',
        ...(pt?.tags ?? []),
        en?.title ?? '',
        en?.excerpt ?? '',
        ...(en?.tags ?? []),
      ].join(' ')
      const score = scoreDocument(signals.tokens, signals.matchedTechs, text)
      return { post, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) {
    return query.trim() ? posts.slice(0, 3) : posts.slice(0, 5)
  }
  return scored.slice(0, 4).map((item) => item.post)
}

export interface ScoredPostSection {
  section: IndexedPostSection
  score: number
}

/**
 * Searches indexed Markdown sections across published blog posts, prioritizing
 * the active locale while still covering monolingual articles in the other language.
 */
export function searchPostSectionsScored(
  query: string,
  sections: readonly IndexedPostSection[],
  signals: QuerySignals,
  locale: Locale,
): ScoredPostSection[] {
  if (sections.length === 0 || !query.trim()) return []

  const slugsInLocale = new Set(
    sections.filter((sec) => sec.locale === locale).map((sec) => sec.slug),
  )

  const candidates = sections.filter(
    (sec) => sec.locale === locale || !slugsInLocale.has(sec.slug),
  )

  const scored = candidates
    .map((section) => {
      const headingScore = section.headingText
        ? scoreDocument(signals.tokens, signals.matchedTechs, section.headingText) * 1.6
        : 0
      const bodyScore = scoreDocument(signals.tokens, signals.matchedTechs, section.text)
      const metaScore =
        scoreDocument(
          signals.tokens,
          signals.matchedTechs,
          `${section.postTitle} ${section.tags.join(' ')}`,
        ) * 0.65
      const anchorBonus = section.headingId && headingScore + bodyScore > 0 ? 1.5 : 0
      return {
        section,
        score: headingScore + bodyScore + metaScore + anchorBonus,
      }
    })
    .filter((entry) => entry.score >= 3)
    .sort((a, b) => b.score - a.score)

  // Cap at 2 sections per article so a single long essay never crowds out other posts
  const perSlug = new Map<string, number>()
  const picked: ScoredPostSection[] = []
  for (const entry of scored) {
    const count = perSlug.get(entry.section.slug) ?? 0
    if (count >= 2) continue
    perSlug.set(entry.section.slug, count + 1)
    picked.push(entry)
    if (picked.length >= 4) break
  }

  return picked
}

export function searchPostSections(
  query: string,
  sections: readonly IndexedPostSection[],
  signals: QuerySignals,
  locale: Locale,
): IndexedPostSection[] {
  return searchPostSectionsScored(query, sections, signals, locale).map(
    (entry) => entry.section,
  )
}

export function searchKnowledge(
  query: string,
  locale: Locale,
  notes?: readonly KnowledgeNote[],
): KnowledgeNote[] {
  const norm = normalizeText(query)
  const tokens = tokenize(query)
  const active = activeKnowledgeNotes(notes)
  return active
    .map((note) => {
      let score = 0
      for (const kw of note.keywords) {
        if (containsPhrase(norm, kw)) score += 4
      }
      score += scoreDocument(tokens, [], note.title[locale]) * 0.85
      score += scoreDocument(tokens, [], note.body[locale]) * 0.45
      return { note, score }
    })
    .filter((entry) => entry.score >= 3)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.note)
}

/**
 * Extracts a concise role title from the first line of a pasted Job Description
 * when present (e.g. `Senior Full-Stack Engineer`).
 */
function extractRoleHint(raw: string): string | undefined {
  const firstLine = raw
    .replace(/^\/fit\s*/i, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length >= 6 && !/^[-•*]/.test(line))
  if (!firstLine) return undefined
  if (firstLine.length > 88) return `${firstLine.slice(0, 85)}…`
  return firstLine
}

/**
 * Maps every skill found in a Job Description to real projects, client
 * engagements, and stack items — and honestly surfaces requirements absent from
 * Marcus's public dossier.
 */
export function analyzeJobFit(
  rawInput: string,
  content: SiteContent,
  locale: Locale,
): FitReport {
  const body = rawInput.replace(/^\/fit\s*/i, '').trim()
  const signals = extractQuerySignals(body, content)
  const roleHint = extractRoleHint(rawInput)

  const matched: FitEvidenceItem[] = []

  for (const skill of signals.matchedTechs) {
    const stackEntry = content.techStack.find(
      (item) => normalizeText(item.name) === normalizeText(skill),
    )
    const proofs: FitEvidenceItem['proofs'] = []
    const normSkill = normalizeText(skill)

    // Matching client engagements (production proof)
    for (const eng of content.experience.projects) {
      const hay = normalizeText(
        `${eng.stack.join(' ')} ${eng.scope.pt} ${eng.scope.en} ${eng.title.pt} ${eng.title.en}`,
      )
      const aliasHit =
        containsPhrase(hay, skill) ||
        (skill === 'Node.js' && containsPhrase(hay, 'node')) ||
        (skill === 'C#' && containsPhrase(hay, 'asp.net')) ||
        (skill === 'PostgreSQL' && containsPhrase(hay, 'postgresql')) ||
        (skill === 'MCP' && containsPhrase(hay, 'ai'))
      if (aliasHit) {
        proofs.push({
          label: `${eng.client} · ${eng.title[locale]}`,
          kind: 'experience',
          detail: eng.scope[locale],
          href: '/#experience',
        })
      }
    }

    // Matching public projects
    for (const project of content.projects) {
      const hay = normalizeText(
        `${project.stack.join(' ')} ${project.description.pt} ${project.description.en}`,
      )
      const aliasHit =
        containsPhrase(hay, skill) ||
        (skill === 'Tauri' && containsPhrase(hay, 'tauri')) ||
        (skill === 'React' && containsPhrase(hay, 'next.js'))
      if (aliasHit) {
        proofs.push({
          label: `${project.title} (${project.year})`,
          kind: 'project',
          detail: project.description[locale],
          href: project.url,
          external: true,
        })
      }
    }

    // Fallback to stack evidence if listed in CMS stack without a featured card
    if (proofs.length === 0 && stackEntry) {
      proofs.push({
        label: locale === 'pt' ? `Stack publicado (${stackEntry.category})` : `Published stack (${stackEntry.category})`,
        kind: 'stack',
        detail:
          locale === 'pt'
            ? `${stackEntry.name} faz parte do stack publicado na categoria ${stackEntry.category}.`
            : `${stackEntry.name} is part of the published ${stackEntry.category} stack.`,
        href: '/#craft',
      })
    }

    if (proofs.length > 0 && !matched.some((item) => normalizeText(item.skill) === normSkill)) {
      matched.push({
        skill,
        category: stackEntry?.category ?? 'domain',
        proofs: proofs.slice(0, 3),
      })
    }
  }

  const gaps: FitGapItem[] = signals.externalTechs.map((entry) => ({
    term: entry.name,
    adjacent: [...entry.adjacent],
  }))

  // Rank projects & client engagements by how many JD terms they prove
  const relevantProjects = content.projects
    .map((project) => {
      const hay = normalizeText(
        `${project.title} ${project.stack.join(' ')} ${project.description.pt} ${project.description.en}`,
      )
      const matchedTerms = signals.matchedTechs.filter(
        (term) =>
          containsPhrase(hay, term) ||
          (term === 'Tauri' && containsPhrase(hay, 'tauri')) ||
          (term === 'React' && containsPhrase(hay, 'next.js')),
      )
      return {
        index: project.index,
        title: project.title,
        url: project.url,
        matchedTerms,
        summary: project.description[locale],
      }
    })
    .filter((entry) => entry.matchedTerms.length > 0)
    .sort((a, b) => b.matchedTerms.length - a.matchedTerms.length)
    .slice(0, 4)

  const relevantEngagements = content.experience.projects
    .map((eng) => {
      const hay = normalizeText(
        `${eng.client} ${eng.sector.pt} ${eng.sector.en} ${eng.stack.join(' ')} ${eng.scope.pt} ${eng.scope.en}`,
      )
      const matchedTerms = signals.matchedTechs.filter(
        (term) =>
          containsPhrase(hay, term) ||
          (term === 'Node.js' && containsPhrase(hay, 'node')) ||
          (term === 'C#' && containsPhrase(hay, 'asp.net')),
      )
      return {
        id: eng.id,
        client: eng.client,
        title: eng.title[locale],
        sector: eng.sector[locale],
        matchedTerms,
        scope: eng.scope[locale],
      }
    })
    .filter((entry) => entry.matchedTerms.length > 0)
    .sort((a, b) => b.matchedTerms.length - a.matchedTerms.length)
    .slice(0, 4)

  const markdownBrief = formatFitMarkdown({
    locale,
    profileName: content.profile.name,
    email: content.profile.email,
    roleHint,
    matched,
    gaps,
    relevantProjects,
    relevantEngagements,
  })

  return {
    roleHint,
    matched,
    gaps,
    relevantProjects,
    relevantEngagements,
    markdownBrief,
  }
}

function formatFitMarkdown(input: {
  locale: Locale
  profileName: string
  email: string
  roleHint?: string
  matched: FitEvidenceItem[]
  gaps: FitGapItem[]
  relevantProjects: FitReport['relevantProjects']
  relevantEngagements: FitReport['relevantEngagements']
}): string {
  const { locale, profileName, email, roleHint, matched, gaps, relevantProjects, relevantEngagements } =
    input
  const isPt = locale === 'pt'
  const lines: string[] = [
    `# ${isPt ? 'Briefing de Fit por Evidências' : 'Evidence-Based Role Fit Brief'} — ${profileName}`,
    ...(roleHint ? [`> ${isPt ? 'Vaga analisada' : 'Analyzed role'}: ${roleHint}`] : []),
    '',
    `## ${isPt ? 'Requisitos com evidência registrada' : 'Requirements with verified evidence'} (${matched.length})`,
    '',
    ...(matched.length > 0
      ? matched.map(
          (item) =>
            `- **${item.skill}** — ${item.proofs.map((proof) => proof.label).join('; ')}`,
        )
      : [isPt ? '- Nenhum requisito técnico específico identificado no texto.' : '- No specific technical requirement extracted from the text.']),
    '',
    `## ${isPt ? 'Não registrado no dossiê público (lacunas honestas)' : 'Not listed in public dossier (honest gaps)'} (${gaps.length})`,
    '',
    ...(gaps.length > 0
      ? gaps.map((gap) =>
          gap.adjacent.length > 0
            ? `- **${gap.term}** (${isPt ? 'experiência adjacente' : 'adjacent experience'}: ${gap.adjacent.join(', ')})`
            : `- **${gap.term}**`,
        )
      : [isPt ? '- Nenhuma tecnologia fora do stack público foi detectada.' : '- No unlisted technologies were detected in the text.']),
  ]

  if (relevantEngagements.length > 0) {
    lines.push(
      '',
      `## ${isPt ? 'Entregas em produção mais relevantes' : 'Most relevant production engagements'}`,
      '',
      ...relevantEngagements.map(
        (eng) => `- **${eng.client}** (${eng.sector}) — ${eng.title}: ${eng.scope}`,
      ),
    )
  }

  if (relevantProjects.length > 0) {
    lines.push(
      '',
      `## ${isPt ? 'Projetos públicos mais relevantes' : 'Most relevant public projects'}`,
      '',
      ...relevantProjects.map((project) => `- **[${project.title}](${project.url})** — ${project.summary}`),
    )
  }

  lines.push(
    '',
    '---',
    isPt
      ? `Fonte: https://marcusboni.com.br/ask · Contato: ${email}`
      : `Source: https://marcusboni.com.br/en/ask · Contact: ${email}`,
  )

  return lines.join('\n')
}
