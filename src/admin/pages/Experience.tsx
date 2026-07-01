import { useAdminContent } from '@/admin/AdminContentContext'
import { SaveBar } from '@/admin/components/SaveBar'
import {
  AdminButton,
  Card,
  Field,
  PageHeader,
  SectionLabel,
  Spinner,
  TextArea,
  TextInput,
  Toggle,
} from '@/admin/components/ui'
import type { ExperienceProject } from '@/content/types'

function emptyEntry(): ExperienceProject {
  return {
    id: `exp-${Date.now().toString(36)}`,
    client: 'Novo cliente',
    title: { pt: '', en: '' },
    sector: { pt: '', en: '' },
    scope: { pt: '', en: '' },
    stack: [],
  }
}

export function Experience() {
  const { draft, loading, update } = useAdminContent()

  if (loading) return <Spinner label="Carregando conteúdo" />

  const exp = draft.experience

  const setMeta = (patch: Partial<typeof exp>) =>
    update((d) => {
      d.experience = { ...d.experience, ...patch }
      return d
    })

  const setEntry = (i: number, patch: Partial<ExperienceProject>) =>
    update((d) => {
      d.experience.projects[i] = { ...d.experience.projects[i], ...patch }
      return d
    })

  const move = (i: number, dir: -1 | 1) =>
    update((d) => {
      const list = d.experience.projects
      const j = i + dir
      if (j < 0 || j >= list.length) return d
      ;[list[i], list[j]] = [list[j], list[i]]
      return d
    })

  const remove = (i: number) =>
    update((d) => {
      d.experience.projects.splice(i, 1)
      return d
    })

  const add = () =>
    update((d) => {
      d.experience.projects.push(emptyEntry())
      return d
    })

  return (
    <>
      <PageHeader
        title="Carreira"
        subtitle="A linha do tempo profissional: cargo, empresa e cada cliente atendido."
        actions={
          <AdminButton variant="solid" onClick={add}>
            + Nova experiência
          </AdminButton>
        }
      />

      <Card className="mb-6">
        <SectionLabel>Cargo atual</SectionLabel>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Cargo">
            <TextInput
              value={exp.role}
              onChange={(e) => setMeta({ role: e.target.value })}
            />
          </Field>
          <Field label="Empresa">
            <TextInput
              value={exp.company}
              onChange={(e) => setMeta({ company: e.target.value })}
            />
          </Field>
          <Field label="Início" hint="Formato AAAA-MM">
            <TextInput
              value={exp.start}
              placeholder="2024-06"
              onChange={(e) => setMeta({ start: e.target.value })}
            />
          </Field>
          <div className="flex flex-col gap-3">
            <Field label="Fim" hint="Vazio = atual">
              <TextInput
                value={exp.end ?? ''}
                placeholder="2025-12"
                disabled={exp.end === null}
                onChange={(e) => setMeta({ end: e.target.value })}
              />
            </Field>
            <Toggle
              checked={exp.end === null}
              onChange={(on) => setMeta({ end: on ? null : '' })}
              label="Em andamento"
            />
          </div>
        </div>
      </Card>

      <SectionLabel>Clientes atendidos ({exp.projects.length})</SectionLabel>
      <ul className="flex flex-col gap-5">
        {exp.projects.map((entry, i) => (
          <li key={entry.id}>
            <Card>
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="font-display text-2xl text-bone">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="flex gap-1">
                  <AdminButton variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>
                    ↑
                  </AdminButton>
                  <AdminButton
                    variant="ghost"
                    onClick={() => move(i, 1)}
                    disabled={i === exp.projects.length - 1}
                  >
                    ↓
                  </AdminButton>
                  <AdminButton variant="danger" onClick={() => remove(i)}>
                    Remover
                  </AdminButton>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Cliente">
                  <TextInput
                    value={entry.client}
                    onChange={(e) => setEntry(i, { client: e.target.value })}
                  />
                </Field>
                <Field label="Stack" hint="Separe por vírgula">
                  <TextInput
                    value={entry.stack.join(', ')}
                    onChange={(e) =>
                      setEntry(i, {
                        stack: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </Field>
                <Field label="Título do projeto (PT)">
                  <TextInput
                    value={entry.title.pt}
                    onChange={(e) =>
                      setEntry(i, { title: { ...entry.title, pt: e.target.value } })
                    }
                  />
                </Field>
                <Field label="Título do projeto (EN)">
                  <TextInput
                    value={entry.title.en}
                    onChange={(e) =>
                      setEntry(i, { title: { ...entry.title, en: e.target.value } })
                    }
                  />
                </Field>
                <Field label="Setor (PT)">
                  <TextInput
                    value={entry.sector.pt}
                    onChange={(e) =>
                      setEntry(i, { sector: { ...entry.sector, pt: e.target.value } })
                    }
                  />
                </Field>
                <Field label="Setor (EN)">
                  <TextInput
                    value={entry.sector.en}
                    onChange={(e) =>
                      setEntry(i, { sector: { ...entry.sector, en: e.target.value } })
                    }
                  />
                </Field>
                <Field label="Escopo (PT)">
                  <TextArea
                    value={entry.scope.pt}
                    onChange={(e) =>
                      setEntry(i, { scope: { ...entry.scope, pt: e.target.value } })
                    }
                  />
                </Field>
                <Field label="Escopo (EN)">
                  <TextArea
                    value={entry.scope.en}
                    onChange={(e) =>
                      setEntry(i, { scope: { ...entry.scope, en: e.target.value } })
                    }
                  />
                </Field>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <SaveBar />
    </>
  )
}
