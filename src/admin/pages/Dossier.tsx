import { useCallback, useEffect, useMemo, useState } from 'react'

import { TagInput } from '@/admin/components/TagInput'
import { useConfirm } from '@/admin/components/overlays'
import { DragHandle, MoveButtons } from '@/admin/components/sortable'
import { useToast } from '@/admin/components/toast'
import {
  AdminButton,
  Badge,
  Banner,
  ButtonLink,
  Card,
  Collapsible,
  EmptyState,
  Field,
  IconButton,
  Kbd,
  PageHeader,
  SectionHeader,
  Segmented,
  Select,
  SkeletonRows,
  StatusDot,
  TextArea,
  TextInput,
  Toggle,
  focusRing,
} from '@/admin/components/ui'
import { useHotkey } from '@/admin/hooks'
import { useSortable } from '@/admin/lib/use-sortable'
import {
  KNOWLEDGE_TOPICS,
  KNOWLEDGE_TOPIC_LABELS,
  cloneDefaultKnowledgeNotes,
  createEmptyKnowledgeNote,
  type DossierKnowledgeConfig,
} from '@/agent/dossier-cms'
import {
  fetchDossierKnowledge,
  resetDossierKnowledge,
  saveDossierKnowledge,
} from '@/agent/dossier-service'
import type { KnowledgeNote, KnowledgeNoteTopic } from '@/agent/knowledge'
import { isFirebaseConfigured } from '@/lib/firebase'
import { cn } from '@/lib/utils'

type NoteFilter = 'all' | 'core' | 'faq' | 'hidden'

function noteIssues(note: KnowledgeNote): string[] {
  const issues: string[] = []
  if (!note.title.pt.trim()) issues.push('sem título PT')
  if (!note.title.en.trim()) issues.push('sem título EN')
  if (!note.body.pt.trim()) issues.push('sem conteúdo PT')
  if (!note.body.en.trim()) issues.push('sem conteúdo EN')
  if (note.keywords.length === 0) issues.push('sem palavras-chave')
  return issues
}

/**
 * Editable editorial knowledge base for the interactive Dossier console (`/ask`
 * and `⌘K`). Stored at `content/dossier` in Firestore with clean static
 * fallback to `src/agent/knowledge.ts`.
 */
export function Dossier() {
  const confirm = useConfirm()
  const toast = useToast()

  const [server, setServer] = useState<DossierKnowledgeConfig>(() => ({
    notes: cloneDefaultKnowledgeNotes(),
  }))
  const [draft, setDraft] = useState<KnowledgeNote[]>(cloneDefaultKnowledgeNotes)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(['DOC·01']))
  const [filter, setFilter] = useState<NoteFilter>('all')

  useEffect(() => {
    let active = true
    fetchDossierKnowledge({ forceRefresh: true })
      .then((config) => {
        if (!active) return
        setServer(config)
        setDraft(structuredClone(config.notes))
      })
      .catch((cause: unknown) => {
        if (!active) return
        setError(
          cause instanceof Error
            ? `Falha ao carregar o dossiê: ${cause.message}`
            : 'Falha ao carregar a base do dossiê.',
        )
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(server.notes),
    [draft, server.notes],
  )

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const patchNote = (id: string, patch: Partial<KnowledgeNote>) => {
    setDraft((prev) =>
      prev.map((note) => (note.id === id ? { ...note, ...patch } : note)),
    )
  }

  const moveNote = (from: number, to: number) => {
    setDraft((prev) => {
      if (to < 0 || to >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const sortable = useSortable(moveNote)

  const addNote = () => {
    const created = createEmptyKnowledgeNote(draft)
    setDraft((prev) => [...prev, created])
    setFilter('all')
    setOpenIds((prev) => new Set(prev).add(created.id))
  }

  const removeNote = async (note: KnowledgeNote, index: number) => {
    const yes = await confirm({
      title: `Remover “${note.title.pt || note.id}”?`,
      description:
        'A nota deixa de ser usada nas respostas e citações do /ask assim que você salvar.',
      confirmLabel: 'Remover',
      tone: 'danger',
    })
    if (!yes) return
    setDraft((prev) => prev.filter((_, idx) => idx !== index))
    toast.info(`Nota ${note.id} removida.`, {
      action: {
        label: 'Desfazer',
        onClick: () =>
          setDraft((prev) => {
            const next = [...prev]
            next.splice(index, 0, note)
            return next
          }),
      },
    })
  }

  const onSave = useCallback(async () => {
    if (!dirty || saving || !isFirebaseConfigured) return
    setSaving(true)
    setError(null)
    try {
      const saved = await saveDossierKnowledge(draft)
      setServer(saved)
      setDraft(structuredClone(saved.notes))
      setSavedAt(new Date())
      toast.success('Base editorial do dossiê publicada.')
    } catch (cause) {
      const msg =
        cause instanceof Error
          ? cause.message
          : 'Não foi possível salvar a base do dossiê.'
      setError(msg)
      toast.error('Não foi possível salvar. Veja o detalhe na barra.')
    } finally {
      setSaving(false)
    }
  }, [dirty, saving, draft, toast])

  const onRevert = async () => {
    const yes = await confirm({
      title: 'Descartar alterações do dossiê?',
      description: 'As notas voltam ao estado atualmente publicado.',
      confirmLabel: 'Descartar',
      tone: 'danger',
    })
    if (!yes) return
    setDraft(structuredClone(server.notes))
    setError(null)
    toast.info('Alterações descartadas.')
  }

  const onResetDefaults = async () => {
    const yes = await confirm({
      title: 'Restaurar notas padrão do dossiê?',
      description:
        'Disponibilidade, processo, IA aplicada, idiomas, API e contato voltam aos textos originais do código e FAQs extras são removidas.',
      confirmLabel: 'Restaurar padrões',
      requireText: 'RESTAURAR',
      tone: 'danger',
    })
    if (!yes) return
    setSaving(true)
    setError(null)
    try {
      const restored = await resetDossierKnowledge()
      setServer(restored)
      setDraft(structuredClone(restored.notes))
      setSavedAt(new Date())
      toast.success('Notas do dossiê restauradas para os padrões do código.')
    } catch (cause) {
      const msg =
        cause instanceof Error ? cause.message : 'Falha ao restaurar padrões.'
      setError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  useHotkey({ key: 's', mod: true }, () => void onSave())

  const counts = useMemo(() => {
    let active = 0
    let core = 0
    let faq = 0
    let hidden = 0
    for (const note of draft) {
      if (note.enabled === false) hidden += 1
      else active += 1
      if (note.topic === 'faq') faq += 1
      else core += 1
    }
    return { active, core, faq, hidden }
  }, [draft])

  const filtered = useMemo(() => {
    return draft
      .map((note, index) => ({ note, index }))
      .filter(({ note }) => {
        if (filter === 'core') return note.topic !== 'faq'
        if (filter === 'faq') return note.topic === 'faq'
        if (filter === 'hidden') return note.enabled === false
        return true
      })
  }, [draft, filter])

  const allExpanded =
    filtered.length > 0 && filtered.every(({ note }) => openIds.has(note.id))

  const toggleAll = () => {
    if (allExpanded) {
      setOpenIds(new Set())
    } else {
      setOpenIds(new Set(filtered.map(({ note }) => note.id)))
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader
          title="Dossiê IA"
          subtitle="Carregando notas editoriais do console interativo…"
        />
        <SkeletonRows rows={4} height="h-16" />
      </>
    )
  }

  const barStatus = !isFirebaseConfigured
    ? 'Modo demo — alterações não persistem'
    : saving
      ? 'Salvando no Firestore…'
      : dirty
        ? 'Alterações não salvas no dossiê'
        : savedAt
          ? `Publicado às ${savedAt.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}`
          : server.updatedAt
            ? `Sincronizado (${new Date(server.updatedAt).toLocaleDateString('pt-BR')})`
            : 'Usando padrões do código'

  return (
    <>
      <PageHeader
        title="Dossiê IA"
        subtitle="Edite disponibilidade, formatos de contrato, filosofia de trabalho e FAQs citadas no /ask e no ⌘K sem precisar de deploy."
        meta={
          <>
            <Badge tone="ember">{counts.active} ativa(s)</Badge>
            {counts.hidden > 0 && <Badge tone="muted">{counts.hidden} oculta(s)</Badge>}
            <ButtonLink href="/ask" external variant="outline" size="sm">
              ↗ Abrir /ask
            </ButtonLink>
          </>
        }
      />

      {!isFirebaseConfigured && (
        <div className="mb-6">
          <Banner tone="warn" title="Modo demo ativo">
            Configure as variáveis <span className="font-mono">VITE_FIREBASE_*</span> para
            publicar alterações em <span className="font-mono">content/dossier</span>.
          </Banner>
        </div>
      )}

      {/* ─── Toolbar ───────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Segmented<NoteFilter>
          label="Filtrar notas do dossiê"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Todas', count: draft.length },
            { value: 'core', label: 'Base', count: counts.core },
            { value: 'faq', label: 'FAQs', count: counts.faq },
            ...(counts.hidden > 0
              ? [{ value: 'hidden' as const, label: 'Ocultas', count: counts.hidden }]
              : []),
          ]}
        />

        <div className="flex flex-wrap items-center gap-2">
          {filtered.length > 0 && (
            <AdminButton variant="ghost" size="sm" onClick={toggleAll}>
              {allExpanded ? 'Recolher tudo' : 'Expandir tudo'}
            </AdminButton>
          )}
          <AdminButton variant="solid" size="sm" onClick={addNote}>
            + Nova nota / FAQ
          </AdminButton>
        </div>
      </div>

      {/* ─── Notes list ────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhuma nota neste filtro"
          description="Crie uma FAQ personalizada para responder perguntas recorrentes de recrutadores, CTOs ou clientes diretamente com citação."
          action={
            <AdminButton variant="solid" onClick={addNote}>
              + Criar primeira FAQ
            </AdminButton>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(({ note, index }) => {
            const isOpen = openIds.has(note.id)
            const issues = noteIssues(note)
            const disabled = note.enabled === false

            return (
              <div
                key={note.id}
                {...(filter === 'all' ? sortable.rowProps(index) : {})}
                className={filter === 'all' ? sortable.rowClass(index) : undefined}
              >
                <Collapsible
                  open={isOpen}
                  tone={issues.length > 0 ? 'attention' : 'default'}
                  onToggle={() =>
                    setOpenIds((prev) => {
                      const next = new Set(prev)
                      if (next.has(note.id)) next.delete(note.id)
                      else next.add(note.id)
                      return next
                    })
                  }
                  summary={
                    <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                      <span className="font-mono text-[10px] tracking-[0.16em] text-ember">
                        {note.id}
                      </span>
                      <span
                        className={cn(
                          'min-w-0 truncate text-sm font-medium',
                          disabled ? 'text-smoke line-through' : 'text-bone',
                        )}
                      >
                        {note.title.pt || note.title.en || '(sem título)'}
                      </span>
                      <Badge tone={note.topic === 'faq' ? 'ember' : 'muted'}>
                        {KNOWLEDGE_TOPIC_LABELS[note.topic]}
                      </Badge>
                      {disabled && <Badge tone="muted">oculta</Badge>}
                      {issues.length > 0 && (
                        <Badge tone="warn" title={issues.join(' · ')}>
                          {issues.length} pendência(s)
                        </Badge>
                      )}
                      <span className="ml-auto hidden font-mono text-[10px] text-smoke sm:inline">
                        {note.keywords.length} palavra(s)-chave
                      </span>
                    </div>
                  }
                  aside={
                    <>
                      {filter === 'all' && (
                        <>
                          <DragHandle {...sortable.handleProps(index)} />
                          <MoveButtons
                            index={index}
                            total={draft.length}
                            onMove={moveNote}
                          />
                        </>
                      )}
                      <IconButton
                        label={`Remover ${note.id}`}
                        variant="ghost"
                        size="sm"
                        onClick={() => void removeNote(note, index)}
                      >
                        ✕
                      </IconButton>
                    </>
                  }
                >
                  <div className="flex flex-col gap-5">
                    <div className="grid gap-4 md:grid-cols-3">
                      <Field label="Tópico">
                        <Select
                          value={note.topic}
                          onChange={(event) =>
                            patchNote(note.id, {
                              topic: event.target.value as KnowledgeNoteTopic,
                            })
                          }
                        >
                          {KNOWLEDGE_TOPICS.map((topic) => (
                            <option key={topic} value={topic}>
                              {KNOWLEDGE_TOPIC_LABELS[topic]}
                            </option>
                          ))}
                        </Select>
                      </Field>

                      <Field
                        label="Link de referência"
                        hint="Ex.: /contact, /about, /#work ou https://..."
                      >
                        <TextInput
                          value={note.href}
                          onChange={(event) =>
                            patchNote(note.id, { href: event.target.value })
                          }
                          placeholder="/contact"
                          className="font-mono text-xs"
                        />
                      </Field>

                      <div className="flex items-end pb-1">
                        <Toggle
                          checked={!disabled}
                          onChange={(checked) => patchNote(note.id, { enabled: checked })}
                          label="Ativa no dossiê"
                          hint={
                            disabled
                              ? 'Oculta das buscas e citações'
                              : 'Indexada no /ask e Edge LLM'
                          }
                        />
                      </div>
                    </div>

                    {/* ─── Bilingual Title & Body ────────────────────── */}
                    <div className="flex items-center justify-between gap-2 border-t border-line pt-4">
                      <span className="font-mono text-[10px] tracking-[0.2em] text-smoke uppercase">
                        Conteúdo bilíngue (PT-BR & EN)
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          patchNote(note.id, {
                            title: { ...note.title, en: note.title.pt },
                            body: { ...note.body, en: note.body.pt },
                          })
                        }
                        className={cn(
                          'font-mono text-[10px] tracking-[0.16em] text-smoke uppercase transition-colors hover:text-ember',
                          focusRing,
                        )}
                      >
                        Copiar PT → EN
                      </button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Título (PT-BR)">
                        <TextInput
                          value={note.title.pt}
                          onChange={(event) =>
                            patchNote(note.id, {
                              title: { ...note.title, pt: event.target.value },
                            })
                          }
                          placeholder="Ex.: Aviso prévio e modelo de contratação"
                        />
                      </Field>

                      <Field label="Title (EN)">
                        <TextInput
                          value={note.title.en}
                          onChange={(event) =>
                            patchNote(note.id, {
                              title: { ...note.title, en: event.target.value },
                            })
                          }
                          placeholder="e.g. Notice period & engagement model"
                        />
                      </Field>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Field
                        label="Conteúdo (PT-BR)"
                        hint={`${note.body.pt.length} caracteres · citado literalmente como [${note.id}]`}
                      >
                        <TextArea
                          rows={4}
                          value={note.body.pt}
                          onChange={(event) =>
                            patchNote(note.id, {
                              body: { ...note.body, pt: event.target.value },
                            })
                          }
                          placeholder="Resposta direta, factual e verificável que o dossiê e o Edge LLM usarão como fonte."
                        />
                      </Field>

                      <Field
                        label="Content (EN)"
                        hint={`${note.body.en.length} chars · cited verbatim as [${note.id}]`}
                      >
                        <TextArea
                          rows={4}
                          value={note.body.en}
                          onChange={(event) =>
                            patchNote(note.id, {
                              body: { ...note.body, en: event.target.value },
                            })
                          }
                          placeholder="Direct, verifiable answer used as grounding by the dossier and Edge LLM."
                        />
                      </Field>
                    </div>

                    <Field
                      label="Palavras-chave de disparo"
                      hint="Termos em PT e EN que ativam esta nota (pressione Enter ou vírgula para adicionar)"
                    >
                      <TagInput
                        values={note.keywords}
                        onChange={(keywords) => patchNote(note.id, { keywords })}
                        transform={(value) => value.toLowerCase()}
                        placeholder="ex.: remoto, aviso previo, mentoria, lideranca"
                      />
                    </Field>
                  </div>
                </Collapsible>
              </div>
            )
          })}
        </div>
      )}

      {/* ─── Danger zone (reset to static defaults) ────────────── */}
      <Card className="mt-8 border-ember-deep/40">
        <SectionHeader
          label="Restaurar base padrão"
          hint="Reescreve content/dossier com as 6 notas originais de src/agent/knowledge.ts."
        />
        <p className="mb-4 max-w-xl text-sm text-bone-dim">
          Útil se quiser voltar às notas iniciais do código. O restante do site
          (perfil, projetos, carreira e blog) não é afetado.
        </p>
        <AdminButton
          variant="danger"
          onClick={() => void onResetDefaults()}
          loading={saving}
          disabled={!isFirebaseConfigured}
        >
          Restaurar padrões do dossiê
        </AdminButton>
      </Card>

      {/* ─── Sticky save bar ───────────────────────────────────── */}
      <div className="sticky bottom-4 z-20 mt-8">
        <div
          className={cn(
            'flex flex-col gap-3 border bg-ink-soft/95 px-5 py-3 backdrop-blur transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-4',
            error ? 'border-ember-deep/70' : dirty ? 'border-ember/50' : 'border-line',
          )}
        >
          <div className="min-w-0">
            <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-smoke uppercase">
              <StatusDot
                tone={saving ? 'live' : dirty ? 'idle' : 'live'}
                pulse={saving}
              />
              <span className="truncate">{barStatus}</span>
            </span>
            {error && <p className="mt-1 text-xs break-words text-ember">{error}</p>}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="mr-1 hidden items-center gap-1 font-mono text-[9px] tracking-[0.16em] text-smoke/70 uppercase lg:flex">
              <Kbd>Ctrl</Kbd>
              <Kbd>S</Kbd>
            </span>
            <AdminButton
              variant="ghost"
              onClick={() => void onRevert()}
              disabled={!dirty || saving}
            >
              Descartar
            </AdminButton>
            <AdminButton
              variant="solid"
              onClick={() => void onSave()}
              loading={saving}
              disabled={!dirty || !isFirebaseConfigured}
            >
              {saving ? 'Salvando' : 'Salvar no dossiê'}
            </AdminButton>
          </div>
        </div>
      </div>
    </>
  )
}
