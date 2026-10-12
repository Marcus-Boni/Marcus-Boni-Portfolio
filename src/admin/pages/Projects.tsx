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
  Collapsible,
  EmptyState,
  Field,
  IconButton,
  PageHeader,
  SearchInput,
  Skeleton,
  TextArea,
  TextInput,
  focusRing,
} from '@/admin/components/ui'
import { isValidUrl, projectIssues } from '@/admin/lib/health'
import { useSortable } from '@/admin/lib/use-sortable'
import { makeId } from '@/content/ids'
import type { Project } from '@/content/types'
import { cn } from '@/lib/utils'

function emptyProject(index: number): Project {
  return {
    id: makeId('proj'),
    index: String(index + 1).padStart(2, '0'),
    title: 'Novo projeto',
    description: { pt: '', en: '' },
    stack: [],
    year: String(new Date().getFullYear()),
    url: '',
  }
}

/**
 * The Trabalho section editor.
 *
 * Collapsed by default with a summary per row: the list is a list again, and
 * the order on screen is the order on the site. Every destructive action is
 * undoable from the toast, so reordering and pruning stop being scary.
 */
export function Projects() {
  const { draft, loading, update } = useAdminContent()
  const confirm = useConfirm()
  const toast = useToast()
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')

  const projects = draft.projects

  const setProject = (id: string, patch: Partial<Project>) =>
    update((d) => {
      const index = d.projects.findIndex((project) => project.id === id)
      if (index >= 0) d.projects[index] = { ...d.projects[index], ...patch }
      return d
    })

  const move = (from: number, to: number) =>
    update((d) => {
      if (to < 0 || to >= d.projects.length) return d
      const [moved] = d.projects.splice(from, 1)
      d.projects.splice(to, 0, moved)
      return d
    })

  const sortable = useSortable(move)

  const remove = async (project: Project, index: number) => {
    const yes = await confirm({
      title: `Remover “${project.title}”?`,
      description: 'Sai da seção Trabalho do site quando você salvar.',
      confirmLabel: 'Remover',
      tone: 'danger',
    })
    if (!yes) return
    update((d) => {
      d.projects.splice(index, 1)
      return d
    })
    toast.info(`“${project.title}” removido.`, {
      action: {
        label: 'Desfazer',
        onClick: () =>
          update((d) => {
            d.projects.splice(index, 0, project)
            return d
          }),
      },
    })
  }

  const duplicate = (project: Project, index: number) =>
    update((d) => {
      d.projects.splice(index + 1, 0, {
        ...structuredClone(project),
        id: makeId('proj'),
        title: `${project.title} (cópia)`,
      })
      return d
    })

  const add = () => {
    const created = emptyProject(projects.length)
    update((d) => {
      d.projects.push(created)
      return d
    })
    setOpen((current) => new Set(current).add(created.id!))
    toast.info('Projeto criado. Preencha e salve.')
  }

  /** Re-stamps 01, 02, 03… after a reorder, which is what the site displays. */
  const renumber = () =>
    update((d) => {
      d.projects.forEach((project, index) => {
        project.index = String(index + 1).padStart(2, '0')
      })
      return d
    })

  const misnumbered = projects.some(
    (project, index) => project.index !== String(index + 1).padStart(2, '0'),
  )

  /** Every technology already in use, offered as chips in the stack field. */
  const stackSuggestions = useMemo(() => {
    const all = new Set<string>()
    for (const project of projects) project.stack.forEach((item) => all.add(item))
    for (const tech of draft.techStack) all.add(tech.name)
    return [...all].sort()
  }, [projects, draft.techStack])

  const needle = query.trim().toLowerCase()
  const visible = needle
    ? projects.filter(
        (project) =>
          project.title.toLowerCase().includes(needle) ||
          project.stack.join(' ').toLowerCase().includes(needle) ||
          project.year.includes(needle),
      )
    : projects

  if (loading) {
    return (
      <>
        <PageHeader title="Projetos" subtitle="Carregando o conteúdo publicado…" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-16" />
          ))}
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Projetos"
        subtitle="A seção “Trabalho” do site. A ordem aqui é a ordem lá."
        meta={
          <span className="font-mono text-[10px] tracking-[0.16em] text-smoke uppercase">
            {projects.length} projeto(s)
          </span>
        }
        actions={
          <>
            {misnumbered && (
              <AdminButton
                variant="subtle"
                onClick={renumber}
                title="Reescreve os índices 01, 02, 03… na ordem atual"
              >
                Renumerar
              </AdminButton>
            )}
            <AdminButton
              variant="subtle"
              onClick={() =>
                setOpen((current) =>
                  current.size === projects.length
                    ? new Set()
                    : new Set(projects.map((project) => project.id!)),
                )
              }
            >
              {open.size === projects.length ? 'Recolher tudo' : 'Expandir tudo'}
            </AdminButton>
            <AdminButton variant="solid" onClick={add}>
              + Novo projeto
            </AdminButton>
          </>
        }
      />

      {projects.length > 5 && (
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Filtrar por título, stack ou ano…"
          className="mb-5 md:max-w-sm"
        />
      )}

      {projects.length === 0 ? (
        <EmptyState
          title="Nenhum projeto"
          description="Adicione o primeiro projeto para exibir na seção Trabalho."
          action={
            <AdminButton variant="solid" onClick={add}>
              + Novo projeto
            </AdminButton>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState title="Nada com esse filtro" />
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((project) => {
            const index = projects.indexOf(project)
            const issues = projectIssues(project)
            const expanded = open.has(project.id!)

            return (
              <li
                key={project.id}
                {...sortable.rowProps(index)}
                className={sortable.rowClass(index)}
              >
                <Collapsible
                  open={expanded}
                  tone={issues.length > 0 ? 'attention' : 'default'}
                  onToggle={() =>
                    setOpen((current) => {
                      const next = new Set(current)
                      if (next.has(project.id!)) next.delete(project.id!)
                      else next.add(project.id!)
                      return next
                    })
                  }
                  summary={
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-display text-xl text-ember">{project.index}</span>
                      <span className="truncate text-sm text-bone">
                        {project.title || '(sem título)'}
                      </span>
                      <span className="font-mono text-[10px] text-smoke">{project.year}</span>
                      {project.stack.slice(0, 3).map((item) => (
                        <span
                          key={item}
                          className="font-mono text-[9px] tracking-[0.14em] text-smoke uppercase"
                        >
                          {item}
                        </span>
                      ))}
                      {project.stack.length > 3 && (
                        <span className="font-mono text-[9px] text-smoke">
                          +{project.stack.length - 3}
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
                      <MoveButtons index={index} total={projects.length} onMove={move} />
                      <IconButton
                        size="sm"
                        label="Duplicar"
                        onClick={() => duplicate(project, index)}
                      >
                        ⧉
                      </IconButton>
                      <IconButton
                        size="sm"
                        label="Remover"
                        variant="danger"
                        onClick={() => void remove(project, index)}
                      >
                        ✕
                      </IconButton>
                    </>
                  }
                >
                  <div className="grid gap-4 md:grid-cols-4">
                    <Field label="Índice" hint="Exibido em destaque">
                      <TextInput
                        value={project.index}
                        onChange={(event) =>
                          setProject(project.id!, { index: event.target.value })
                        }
                      />
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Título" required>
                        <TextInput
                          value={project.title}
                          onChange={(event) =>
                            setProject(project.id!, { title: event.target.value })
                          }
                        />
                      </Field>
                    </div>
                    <Field
                      label="Ano"
                      error={/^\d{4}$/.test(project.year) ? null : 'Use quatro dígitos'}
                    >
                      <TextInput
                        value={project.year}
                        inputMode="numeric"
                        invalid={!/^\d{4}$/.test(project.year)}
                        onChange={(event) =>
                          setProject(project.id!, { year: event.target.value })
                        }
                      />
                    </Field>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Field
                      label="Descrição (PT)"
                      counter={[project.description.pt.length, 220]}
                    >
                      <TextArea
                        value={project.description.pt}
                        onChange={(event) =>
                          setProject(project.id!, {
                            description: { ...project.description, pt: event.target.value },
                          })
                        }
                      />
                    </Field>
                    <Field
                      label={
                        <span className="flex items-center gap-2">
                          Descrição (EN)
                          {project.description.pt && !project.description.en && (
                            <button
                              type="button"
                              onClick={() =>
                                setProject(project.id!, {
                                  description: {
                                    ...project.description,
                                    en: project.description.pt,
                                  },
                                })
                              }
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
                      counter={[project.description.en.length, 220]}
                    >
                      <TextArea
                        value={project.description.en}
                        onChange={(event) =>
                          setProject(project.id!, {
                            description: { ...project.description, en: event.target.value },
                          })
                        }
                      />
                    </Field>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Field label="Stack" hint="Enter ou vírgula para adicionar">
                      <TagInput
                        values={project.stack}
                        suggestions={stackSuggestions}
                        onChange={(stack) => setProject(project.id!, { stack })}
                        placeholder="react, typescript…"
                      />
                    </Field>
                    <Field
                      label={
                        <span className="flex items-center gap-2">
                          URL
                          {isValidUrl(project.url) && (
                            <a
                              href={project.url}
                              target="_blank"
                              rel="noreferrer"
                              className={cn(
                                'font-mono text-[9px] tracking-[0.14em] text-ember lowercase hover:underline',
                                focusRing,
                              )}
                            >
                              abrir ↗
                            </a>
                          )}
                        </span>
                      }
                      error={
                        !project.url.trim() || isValidUrl(project.url)
                          ? null
                          : 'Inclua https:// no começo'
                      }
                    >
                      <TextInput
                        type="url"
                        value={project.url}
                        invalid={Boolean(project.url.trim()) && !isValidUrl(project.url)}
                        placeholder="https://github.com/…"
                        onChange={(event) =>
                          setProject(project.id!, { url: event.target.value })
                        }
                      />
                    </Field>
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
