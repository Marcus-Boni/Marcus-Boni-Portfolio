import { useAdminContent } from '@/admin/AdminContentContext'
import { SaveBar } from '@/admin/components/SaveBar'
import {
  AdminButton,
  Card,
  Field,
  PageHeader,
  SectionLabel,
  Select,
  Spinner,
  TextArea,
  TextInput,
  Toggle,
} from '@/admin/components/ui'
import { makeId } from '@/content/ids'
import type { SiteProfile, SocialLink, TechItem } from '@/content/types'

const CATEGORIES: TechItem['category'][] = ['frontend', 'backend', 'data', 'ops']

export function Profile() {
  const { draft, loading, update } = useAdminContent()

  if (loading) return <Spinner label="Carregando conteúdo" />

  const setProfile = (patch: Partial<SiteProfile>) =>
    update((d) => {
      d.profile = { ...d.profile, ...patch }
      return d
    })

  const setTech = (i: number, patch: Partial<TechItem>) =>
    update((d) => {
      d.techStack[i] = { ...d.techStack[i], ...patch }
      return d
    })
  const addTech = () =>
    update((d) => {
      d.techStack.push({ id: makeId('tech'), name: 'Nova tech', category: 'frontend' })
      return d
    })
  const removeTech = (i: number) =>
    update((d) => {
      d.techStack.splice(i, 1)
      return d
    })

  const setSocial = (i: number, patch: Partial<SocialLink>) =>
    update((d) => {
      d.socials[i] = { ...d.socials[i], ...patch }
      return d
    })
  const addSocial = () =>
    update((d) => {
      d.socials.push({ id: makeId('soc'), label: 'Nova rede', handle: '', url: '' })
      return d
    })
  const removeSocial = (i: number) =>
    update((d) => {
      d.socials.splice(i, 1)
      return d
    })

  const p = draft.profile

  return (
    <>
      <PageHeader
        title="Perfil & Stack"
        subtitle="Identidade, biografia, disponibilidade, tecnologias e redes sociais."
      />

      <Card className="mb-6">
        <SectionLabel>Identidade</SectionLabel>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome (curto)">
            <TextInput value={p.name} onChange={(e) => setProfile({ name: e.target.value })} />
          </Field>
          <Field label="Nome completo">
            <TextInput
              value={p.fullName}
              onChange={(e) => setProfile({ fullName: e.target.value })}
            />
          </Field>
          <Field label="Cargo / título">
            <TextInput value={p.role} onChange={(e) => setProfile({ role: e.target.value })} />
          </Field>
          <Field label="E-mail">
            <TextInput
              type="email"
              value={p.email}
              onChange={(e) => setProfile({ email: e.target.value })}
            />
          </Field>
          <Field label="Localização">
            <TextInput
              value={p.location}
              onChange={(e) => setProfile({ location: e.target.value })}
            />
          </Field>
          <Field label="Localização (curta)" hint="Ex.: ES — BRA">
            <TextInput
              value={p.locationShort}
              onChange={(e) => setProfile({ locationShort: e.target.value })}
            />
          </Field>
          <Field label="GitHub (URL)">
            <TextInput value={p.github} onChange={(e) => setProfile({ github: e.target.value })} />
          </Field>
          <Field label="Avatar (URL)">
            <TextInput value={p.avatar} onChange={(e) => setProfile({ avatar: e.target.value })} />
          </Field>
          <Field label="Nº de repositórios">
            <TextInput
              type="number"
              value={String(p.repoCount)}
              onChange={(e) => setProfile({ repoCount: Number(e.target.value) || 0 })}
            />
          </Field>
          <div className="flex items-end">
            <Toggle
              checked={p.available}
              onChange={(on) => setProfile({ available: on })}
              label="Disponível para projetos"
            />
          </div>
        </div>
        <div className="mt-4">
          <Field label="Bio">
            <TextArea value={p.bio} onChange={(e) => setProfile({ bio: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <SectionLabel>Tecnologias ({draft.techStack.length})</SectionLabel>
          <AdminButton variant="outline" onClick={addTech}>
            + Tecnologia
          </AdminButton>
        </div>
        <ul className="flex flex-col gap-3">
          {draft.techStack.map((tech, i) => (
            <li key={tech.id} className="flex flex-wrap items-end gap-3">
              <div className="min-w-40 flex-1">
                <TextInput
                  value={tech.name}
                  onChange={(e) => setTech(i, { name: e.target.value })}
                />
              </div>
              <div className="w-40">
                <Select
                  value={tech.category}
                  onChange={(e) =>
                    setTech(i, { category: e.target.value as TechItem['category'] })
                  }
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
              <AdminButton variant="danger" onClick={() => removeTech(i)}>
                ✕
              </AdminButton>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <SectionLabel>Redes sociais ({draft.socials.length})</SectionLabel>
          <AdminButton variant="outline" onClick={addSocial}>
            + Rede
          </AdminButton>
        </div>
        <ul className="flex flex-col gap-4">
          {draft.socials.map((social, i) => (
            <li key={social.id} className="grid gap-3 md:grid-cols-[1fr_1fr_1.5fr_auto] md:items-end">
              <Field label="Rótulo">
                <TextInput
                  value={social.label}
                  onChange={(e) => setSocial(i, { label: e.target.value })}
                />
              </Field>
              <Field label="Handle">
                <TextInput
                  value={social.handle}
                  onChange={(e) => setSocial(i, { handle: e.target.value })}
                />
              </Field>
              <Field label="URL">
                <TextInput
                  value={social.url}
                  onChange={(e) => setSocial(i, { url: e.target.value })}
                />
              </Field>
              <AdminButton variant="danger" onClick={() => removeSocial(i)}>
                ✕
              </AdminButton>
            </li>
          ))}
        </ul>
      </Card>

      <SaveBar />
    </>
  )
}
