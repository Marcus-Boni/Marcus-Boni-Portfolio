import { useMemo, useState } from 'react'

import { useAdminContent } from '@/admin/AdminContentContext'
import { SaveBar } from '@/admin/components/SaveBar'
import { TagInput } from '@/admin/components/TagInput'
import { useConfirm } from '@/admin/components/overlays'
import { DragHandle, MoveButtons } from '@/admin/components/sortable'
import { useToast } from '@/admin/components/toast'
import {
  AdminButton,
  Badge,
  Card,
  Collapsible,
  EmptyState,
  Field,
  IconButton,
  PageHeader,
  SectionHeader,
  Skeleton,
  TextArea,
  TextInput,
  Toggle,
  focusRing,
} from '@/admin/components/ui'
import { experienceIssues, isValidYearMonth } from '@/admin/lib/health'
import { useSortable } from '@/admin/lib/use-sortable'
import { makeId } from '@/content/ids'
import type { ExperienceProject } from '@/content/types'
import { cn } from '@/lib/utils'

function emptyEntry(): ExperienceProject {
  return {
    id: makeId('exp'),
    client: 'Novo cliente',
    title: { pt: '', en: '' },
    sector: { pt: '', en: '' },
    scope: { pt: '', en: '' },
    stack: [],
  }
}

/** "1 ano e 3 meses" — the same reading the public timeline gives. */
function describeDuration(start: string, end: string | null): string | null {
  if (!isValidYearMonth(start)) return null
  const [startYear, startMonth] = start.split('-').map(Number)
  const finish = end && isValidYearMonth(end) ? end : null
  const target = finish ? finish.split('-').map(Number) : null
  const now = new Date()
  const endYear = target ? target[0] : now.getFullYear()
  const endMonth = target ? target[1] : now.getMonth() + 1

  const months = (endYear - startYear) * 12 + (endMonth - startMonth)
  if (months < 0) return null
  const years = Math.floor(months / 12)
  const rest = months % 12

  const parts: string[] = []
  if (years > 0) parts.push(`${years} ano${years > 1 ? 's' : ''}`)
  if (rest > 0) parts.push(`${rest} ${rest > 1 ? 'meses' : 'mês'}`)
  return parts.length ? parts.join(' e ') : 'menos de um mês'
}

/**
 * The career timeline editor.
 *
 * Same collapsed-row treatment as Projetos, plus the two things this page
 * specifically needed: dates that say when they are wrong (the public timeline
 * silently breaks on a malformed `AAAA-MM`) and a one-click PT→EN copy, since
 * half of these fields start as the same sentence in both languages.
 */
export function Experience() {
  const { draft, loading, update } = useAdminContent()
  const confirm = useConfirm()
  const toast = useToast()
  const [open, setOpen] = useState<Set<string>>(new Set())

  const exp = draft.experience
  const entries = exp.projects

  const setMeta = (patch: Partial<typeof exp>) =>
    update((d) => {
      d.experience = { ...d.experience, ...patch }
      return d
    })

  const setEntry = (id: string, patch: Partial<ExperienceProject>) =>
    update((d) => {
      const index = d.experience.projects.findIndex((entry) => entry.id === id)
      if (index >= 0) {
        d.experience.projects[index] = { ...d.experience.projects[index], ...patch }
      }
      return d
    })

  const move = (from: number, to: number) =>
    update((d) => {
      const list = d.experience.projects
      if (to < 0 || to >= list.length) return d
      const [moved] = list.splice(from, 1)
      list.splice(to, 0, moved)
      return d
    })

  const sortable = useSortable(move)

  const remove = async (entry: ExperienceProject, index: number) => {
    const yes = await confirm({
      title: `Remover “${entry.client}”?`,
      description: 'Sai da linha do tempo quando você salvar.',
      confirmLabel: 'Remover',
      tone: 'danger',
    })
    if (!yes) return
    update((d) => {
      d.experience.projects.splice(index, 1)
      return d
    })
    toast.info(`“${entry.client}” removido.`, {
      action: {
        label: 'Desfazer',
        onClick: () =>
          update((d) => {
            d.experience.projects.splice(index, 0, entry)
            return d
          }),
      },
    })
  }

  const add = () => {
    const created = emptyEntry()
    update((d) => {
      d.experience.projects.push(created)
      return d
    })
    setOpen((current) => new Set(current).add(created.id))
  }

  const stackSuggestions = useMemo(() => {
    const all = new Set<string>()
    for (const entry of entries) entry.stack.forEach((item) => all.add(item))
    for (const tech of draft.techStack) all.add(tech.name)
    return [...all].sort()
  }, [entries, draft.techStack])

  const duration = describeDuration(exp.start, exp.end)
  const startInvalid = !isValidYearMonth(exp.start)
  const endInvalid = exp.end !== null && exp.end !== '' && !isValidYearMonth(exp.end)

  if (loading) {
    return (
      <>
        <PageHeader title="Carreira" subtitle="Carregando o conteúdo publicado…" />
        <Skeleton className="h-48" />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Carreira"
        subtitle="A linha do tempo profissional: cargo, empresa e cada cliente atendido."
        meta={
          <span className="font-mono text-[10px] tracking-[0.16em] text-smoke uppercase">
            {entries.length} cliente(s)
            {duration ? ` · ${duration} no cargo` : ''}
          </span>
        }
        actions={
          <>
            <AdminButton
              variant="subtle"
              onClick={() =>
                setOpen((current) =>
                  current.size === entries.length
                    ? new Set()
                    : new Set(entries.map((entry) => entry.id)),
                )
              }
            >
              {open.size === entries.length ? 'Recolher tudo' : 'Expandir tudo'}
            </AdminButton>
            <AdminButton variant="solid" onClick={add}>
              + Nova experiência
            </AdminButton>
          </>
        }
      />

      <Card className="mb-6">
        <SectionHeader
          label="Cargo atual"
          hint="Alimenta o cabeçalho da seção Trajetória e o schema.org do site."
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Cargo" required>
            <TextInput
              value={exp.role}
              onChange={(event) => setMeta({ role: event.target.value })}
            />
          </Field>
          <Field label="Empresa" required>
            <TextInput
              value={exp.company}
              onChange={(event) => setMeta({ company: event.target.value })}
            />
          </Field>
          <Field
            label="Início"
            hint="Formato AAAA-MM"
            error={startInvalid ? 'Data inválida — ex.: 2024-06' : null}
          >
            <TextInput
              value={exp.start}
              placeholder="2024-06"
              invalid={startInvalid}
              onChange={(event) => setMeta({ start: event.target.value })}
            />
          </Field>
          <div className="flex flex-col gap-3">
            <Field
              label="Fim"
              hint="Vazio = atual"
              error={endInvalid ? 'Data inválida — ex.: 2025-12' : null}
            >
              <TextInput
                value={exp.end ?? ''}
                placeholder="2025-12"
                disabled={exp.end === null}
                invalid={endInvalid}
                onChange={(event) => setMeta({ end: event.target.value })}
              />
            </Field>
            <Toggle
              checked={exp.end === null}
              onChange={(on) => setMeta({ end: on ? null : '' })}
              label="Em andamento"
              hint={duration ? `Hoje isso soma ${duration}.` : undefined}
            />
          </div>
        </div>
      </Card>

      <SectionHeader label={`Clientes atendidos (${entries.length})`} />

      {entries.length === 0 ? (
        <EmptyState
          title="Nenhuma experiência"
          description="Cada cliente atendido vira um nó na linha do tempo."
          action={
            <AdminButton variant="solid" onClick={add}>
              + Nova experiência
            </AdminButton>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry, index) => {
            const issues = experienceIssues(entry)
            const expanded = open.has(entry.id)

            return (
              <li
                key={entry.id}
                {...sortable.rowProps(index)}
                className={sortable.rowClass(index)}
              >
                <Collapsible
                  open={expanded}
                  tone={issues.length > 0 ? 'attention' : 'default'}
                  onToggle={() =>
                    setOpen((current) => {
                      const next = new Set(current)
                      if (next.has(entry.id)) next.delete(entry.id)
                      else next.add(entry.id)
                      return next
                    })
                  }
                  summary={
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-display text-lg text-bone-dim">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="truncate text-sm text-bone">{entry.client}</span>
                      {entry.sector.pt && (
                        <span className="font-mono text-[9px] tracking-[0.14em] text-smoke uppercase">
                          {entry.sector.pt}
                        </span>
                      )}
                      {issues.length > 0 && (
                        <Badge tone="warn" title={issues.join(' · ')}>
                          {issues.length} pendência(s)
                        </Badge>
                      )}
                    </span>
                  }
                  aside={
                    <>
                      <DragHandle {...sortable.handleProps(index)} />
                      <MoveButtons index={index} total={entries.length} onMove={move} />
                      <IconButton
                        size="sm"
                        label="Remover"
                        variant="danger"
                        onClick={() => void remove(entry, index)}
                      >
                        ✕
                      </IconButton>
                    </>
                  }
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Cliente" required>
                      <TextInput
                        value={entry.client}
                        onChange={(event) => setEntry(entry.id, { client: event.target.value })}
                      />
                    </Field>
                    <Field label="Stack" hint="Enter ou vírgula para adicionar">
                      <TagInput
                        values={entry.stack}
                        suggestions={stackSuggestions}
                        onChange={(stack) => setEntry(entry.id, { stack })}
                      />
                    </Field>

                    <BilingualField
                      label="Título do projeto"
                      value={entry.title}
                      onChange={(title) => setEntry(entry.id, { title })}
                    />
                    <BilingualField
                      label="Setor"
                      value={entry.sector}
                      onChange={(sector) => setEntry(entry.id, { sector })}
                    />
                  </div>

                  <div className="mt-4">
                    <BilingualField
                      label="Escopo"
                      multiline
                      value={entry.scope}
                      onChange={(scope) => setEntry(entry.id, { scope })}
                    />
                  </div>
                </Collapsible>
              </li>
            )
          })}
        </ul>
      )}

      <SaveBar />
    </>
  )
}

/**
 * PT and EN side by side, with the copy shortcut on the empty one.
 *
 * Six of these fields per entry is what made the old page a wall — pairing them
 * halves the number of labels and makes a missing translation obvious.
 */
function BilingualField({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string
  value: { pt: string; en: string }
  onChange: (next: { pt: string; en: string }) => void
  multiline?: boolean
}) {
  return (
    <div className={multiline ? 'grid gap-4 md:grid-cols-2' : 'contents'}>
      <Field label={`${label} (PT)`}>
        <LocaleInput
          multiline={multiline}
          value={value.pt}
          onChange={(pt) => onChange({ ...value, pt })}
        />
      </Field>
      <Field
        label={
          <span className="flex items-center gap-2">
            {label} (EN)
            {value.pt && !value.en && (
              <button
                type="button"
                onClick={() => onChange({ ...value, en: value.pt })}
                className={cn(
                  'font-mono text-[9px] tracking-[0.14em] text-ember lowercase hover:underline',
                  focusRing,
                )}
              >
                copiar do PT
              </button>
            )}
          </span>
        }
      >
        <LocaleInput
          multiline={multiline}
          value={value.en}
          onChange={(en) => onChange({ ...value, en })}
        />
      </Field>
    </div>
  )
}

/** One field, two shapes. Branching on the element keeps the prop types exact. */
function LocaleInput({
  multiline,
  value,
  onChange,
}: {
  multiline: boolean
  value: string
  onChange: (next: string) => void
}) {
  return multiline ? (
    <TextArea value={value} onChange={(event) => onChange(event.target.value)} />
  ) : (
    <TextInput value={value} onChange={(event) => onChange(event.target.value)} />
  )
}
