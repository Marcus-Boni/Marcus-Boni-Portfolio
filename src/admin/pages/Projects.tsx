import { useAdminContent } from '@/admin/AdminContentContext'
import { SaveBar } from '@/admin/components/SaveBar'
import {
  AdminButton,
  Card,
  EmptyState,
  Field,
  PageHeader,
  Spinner,
  TextArea,
  TextInput,
} from '@/admin/components/ui'
import { makeId } from '@/content/ids'
import type { Project } from '@/content/types'

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

export function Projects() {
  const { draft, loading, update } = useAdminContent()

  const setProject = (i: number, patch: Partial<Project>) =>
    update((d) => {
      d.projects[i] = { ...d.projects[i], ...patch }
      return d
    })

  const move = (i: number, dir: -1 | 1) =>
    update((d) => {
      const j = i + dir
      if (j < 0 || j >= d.projects.length) return d
      ;[d.projects[i], d.projects[j]] = [d.projects[j], d.projects[i]]
      return d
    })

  const remove = (i: number) =>
    update((d) => {
      d.projects.splice(i, 1)
      return d
    })

  const add = () =>
    update((d) => {
      d.projects.push(emptyProject(d.projects.length))
      return d
    })

  if (loading) return <Spinner label="Carregando conteúdo" />

  return (
    <>
      <PageHeader
        title="Projetos"
        subtitle="A seção “Trabalho” do site. Edite, reordene, adicione ou remova projetos."
        actions={
          <AdminButton variant="solid" onClick={add}>
            + Novo projeto
          </AdminButton>
        }
      />

      {draft.projects.length === 0 ? (
        <EmptyState
          title="Nenhum projeto"
          description="Adicione o primeiro projeto para exibir na seção Trabalho."
        />
      ) : (
        <ul className="flex flex-col gap-5">
          {draft.projects.map((p, i) => (
            <li key={p.id}>
              <Card>
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-display text-3xl text-ember">
                    {p.index}
                  </span>
                  <div className="flex gap-1">
                    <AdminButton variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>
                      ↑
                    </AdminButton>
                    <AdminButton
                      variant="ghost"
                      onClick={() => move(i, 1)}
                      disabled={i === draft.projects.length - 1}
                    >
                      ↓
                    </AdminButton>
                    <AdminButton variant="danger" onClick={() => remove(i)}>
                      Remover
                    </AdminButton>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <Field label="Índice">
                    <TextInput
                      value={p.index}
                      onChange={(e) => setProject(i, { index: e.target.value })}
                    />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Título">
                      <TextInput
                        value={p.title}
                        onChange={(e) => setProject(i, { title: e.target.value })}
                      />
                    </Field>
                  </div>
                  <Field label="Ano">
                    <TextInput
                      value={p.year}
                      onChange={(e) => setProject(i, { year: e.target.value })}
                    />
                  </Field>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="Descrição (PT)">
                    <TextArea
                      value={p.description.pt}
                      onChange={(e) =>
                        setProject(i, {
                          description: { ...p.description, pt: e.target.value },
                        })
                      }
                    />
                  </Field>
                  <Field label="Descrição (EN)">
                    <TextArea
                      value={p.description.en}
                      onChange={(e) =>
                        setProject(i, {
                          description: { ...p.description, en: e.target.value },
                        })
                      }
                    />
                  </Field>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="Stack" hint="Separe por vírgula">
                    <TextInput
                      value={p.stack.join(', ')}
                      onChange={(e) =>
                        setProject(i, {
                          stack: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </Field>
                  <Field label="URL">
                    <TextInput
                      type="url"
                      value={p.url}
                      placeholder="https://github.com/…"
                      onChange={(e) => setProject(i, { url: e.target.value })}
                    />
                  </Field>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <SaveBar />
    </>
  )
}
