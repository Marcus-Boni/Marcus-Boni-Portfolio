import {
  KNOWLEDGE_NOTES,
  type KnowledgeNote,
  type KnowledgeNoteTopic,
} from './knowledge'

/**
 * Pure, dependency-free schema & merge layer for the editable Dossier
 * knowledge base stored in Firestore (`content/dossier`).
 *
 * Kept separate from Firebase SDK imports so both the public retrieval engine
 * and Vitest unit tests can exercise it with zero network or bundle overhead.
 */

export interface DossierKnowledgeConfig {
  notes: KnowledgeNote[]
  updatedAt?: string
}

const VALID_TOPICS = new Set<KnowledgeNoteTopic>([
  'work_model',
  'client_process',
  'ai_philosophy',
  'api_readiness',
  'languages',
  'contact_policy',
  'faq',
])

export const KNOWLEDGE_TOPIC_LABELS: Record<KnowledgeNoteTopic, string> = {
  work_model: 'Disponibilidade & formatos',
  client_process: 'Processo com clientes & escopo',
  ai_philosophy: 'Filosofia de IA aplicada',
  languages: 'Idiomas & comunicação',
  api_readiness: 'Arquitetura & OpenAPI',
  contact_policy: 'Canais de contato',
  faq: 'FAQ personalizada',
}

export const KNOWLEDGE_TOPICS: readonly KnowledgeNoteTopic[] = [
  'work_model',
  'client_process',
  'ai_philosophy',
  'languages',
  'api_readiness',
  'contact_policy',
  'faq',
]

export function cloneDefaultKnowledgeNotes(): KnowledgeNote[] {
  return KNOWLEDGE_NOTES.map((note) => ({
    id: note.id,
    topic: note.topic,
    keywords: [...note.keywords],
    title: { pt: note.title.pt, en: note.title.en },
    body: { pt: note.body.pt, en: note.body.en },
    href: note.href,
    enabled: note.enabled ?? true,
  }))
}

export function defaultDossierKnowledgeConfig(): DossierKnowledgeConfig {
  return {
    notes: cloneDefaultKnowledgeNotes(),
  }
}

function sanitizeHref(raw: unknown, fallback = '/about'): string {
  if (typeof raw !== 'string') return fallback
  const trimmed = raw.trim()
  if (!trimmed) return fallback
  if (trimmed.startsWith('/') || /^https?:\/\//i.test(trimmed)) return trimmed
  return fallback
}

function sanitizeKeywords(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const clean = item.trim().toLowerCase()
    if (!clean || seen.has(clean)) continue
    seen.add(clean)
    out.push(clean)
  }
  return out
}

function sanitizeNote(raw: unknown, index: number): KnowledgeNote | null {
  if (!raw || typeof raw !== 'object') return null
  const candidate = raw as Partial<KnowledgeNote>
  const id =
    typeof candidate.id === 'string' && /^DOC·\d{2}$/.test(candidate.id.trim())
      ? candidate.id.trim()
      : `DOC·${String(index + 1).padStart(2, '0')}`
  const topic: KnowledgeNoteTopic =
    typeof candidate.topic === 'string' && VALID_TOPICS.has(candidate.topic as KnowledgeNoteTopic)
      ? (candidate.topic as KnowledgeNoteTopic)
      : 'faq'

  const ptTitle = typeof candidate.title?.pt === 'string' ? candidate.title.pt.trim() : ''
  const enTitle = typeof candidate.title?.en === 'string' ? candidate.title.en.trim() : ''
  const ptBody = typeof candidate.body?.pt === 'string' ? candidate.body.pt.trim() : ''
  const enBody = typeof candidate.body?.en === 'string' ? candidate.body.en.trim() : ''

  if (!ptTitle && !enTitle && !ptBody && !enBody) return null

  return {
    id,
    topic,
    keywords: sanitizeKeywords(candidate.keywords),
    title: {
      pt: ptTitle || enTitle,
      en: enTitle || ptTitle,
    },
    body: {
      pt: ptBody || enBody,
      en: enBody || ptBody,
    },
    href: sanitizeHref(candidate.href),
    enabled: candidate.enabled !== false,
  }
}

/**
 * Merges a stored Firestore `content/dossier` document over static defaults.
 * Falls back cleanly to `KNOWLEDGE_NOTES` when missing, empty, or malformed.
 */
export function mergeDossierKnowledge(
  partial: Partial<DossierKnowledgeConfig> | undefined,
): DossierKnowledgeConfig {
  if (!partial || !Array.isArray(partial.notes)) {
    return defaultDossierKnowledgeConfig()
  }

  const seenIds = new Set<string>()
  const notes: KnowledgeNote[] = []
  for (let i = 0; i < partial.notes.length; i += 1) {
    const clean = sanitizeNote(partial.notes[i], i)
    if (!clean || seenIds.has(clean.id)) continue
    seenIds.add(clean.id)
    notes.push(clean)
  }

  if (notes.length === 0) {
    return defaultDossierKnowledgeConfig()
  }

  return {
    notes,
    updatedAt: typeof partial.updatedAt === 'string' ? partial.updatedAt : undefined,
  }
}

/** Filters to active editorial notes for retrieval & runtime citations. */
export function activeKnowledgeNotes(
  notes?: readonly KnowledgeNote[],
): readonly KnowledgeNote[] {
  const source = notes && notes.length > 0 ? notes : KNOWLEDGE_NOTES
  return source.filter((note) => note.enabled !== false)
}

/** Generates the next sequential `DOC·NN` identifier (`DOC·07`, `DOC·08`, …). */
export function nextKnowledgeNoteId(existing: readonly KnowledgeNote[]): string {
  let highest = 0
  for (const note of existing) {
    const match = note.id.match(/^DOC·(\d+)$/)
    if (match) {
      const num = Number(match[1])
      if (Number.isFinite(num) && num > highest) highest = num
    }
  }
  const next = Math.min(99, highest + 1)
  return `DOC·${String(next).padStart(2, '0')}`
}

/** Creates a blank custom FAQ note ready for editing in `/admin/dossier`. */
export function createEmptyKnowledgeNote(existing: readonly KnowledgeNote[]): KnowledgeNote {
  return {
    id: nextKnowledgeNoteId(existing),
    topic: 'faq',
    keywords: [],
    title: { pt: '', en: '' },
    body: { pt: '', en: '' },
    href: '/contact',
    enabled: true,
  }
}
