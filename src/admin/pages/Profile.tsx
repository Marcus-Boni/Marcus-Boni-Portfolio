import { useMemo, useState } from 'react'

import { useAdminContent } from '@/admin/AdminContentContext'
import { SaveBar } from '@/admin/components/SaveBar'
import { useConfirm } from '@/admin/components/overlays'
import { DragHandle, MoveButtons } from '@/admin/components/sortable'
import { useToast } from '@/admin/components/toast'
import {
  AdminButton,
  Badge,
  Card,
  CopyButton,
  Field,
  IconButton,
  PageHeader,
  SectionHeader,
  Segmented,
  Select,
  Skeleton,
  TextArea,
  TextInput,
  Toggle,
  focusRing,
} from '@/admin/components/ui'
import { isValidEmail, isValidUrl, socialIssues } from '@/admin/lib/health'
import { useSortable } from '@/admin/lib/use-sortable'
import { makeId } from '@/content/ids'
import type { SiteProfile, SocialLink, TechItem } from '@/content/types'
import { cn } from '@/lib/utils'

type Category = TechItem['category']

const CATEGORIES: Category[] = ['frontend', 'backend', 'data', 'ops']

const CATEGORY_LABEL: Record<Category, string> = {
  frontend: 'Front-end',
  backend: 'Back-end',
  data: 'Dados',
  ops: 'Infra / Ops',
}

/**
 * Identity, stack and socials.
 *
 * The stack used to be one flat list of thirty inputs with a category dropdown
 * on each — you could not tell at a glance how lopsided it was. Grouping by
 * category (with a filter, and an add button per group) turns it into the thing
 * the public Stack section actually renders.
 */
export function Profile() {
  const { draft, loading, update } = useAdminContent()
  const confirm = useConfirm()
  const toast = useToast()
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all')

  const profile = draft.profile

  const setProfile = (patch: Partial<SiteProfile>) =>
    update((d) => {
      d.profile = { ...d.profile, ...patch }
      return d
    })

  /* ─── Tech ──────────────────────────────────────────────── */

  const setTech = (id: string, patch: Partial<TechItem>) =>
    update((d) => {
      const index = d.techStack.findIndex((tech) => tech.id === id)
      if (index >= 0) d.techStack[index] = { ...d.techStack[index], ...patch }
      return d
    })

  const moveTech = (from: number, to: number) =>
    update((d) => {
      if (to < 0 || to >= d.techStack.length) return d
      const [moved] = d.techStack.splice(from, 1)
      d.techStack.splice(to, 0, moved)
      return d
    })

  const techSortable = useSortable(moveTech)

  const addTech = (category: Category) =>
    update((d) => {
      d.techStack.push({ id: makeId('tech'), name: '', category })
      return d
    })

  const removeTech = (tech: TechItem, index: number) => {
    update((d) => {
      d.techStack.splice(index, 1)
      return d
    })
    toast.info(`“${tech.name || 'tecnologia'}” removida.`, {
      action: {
        label: 'Desfazer',
        onClick: () =>
          update((d) => {
            d.techStack.splice(index, 0, tech)
            return d
          }),
      },
    })
  }

  /* ─── Socials ───────────────────────────────────────────── */

  const setSocial = (id: string, patch: Partial<SocialLink>) =>
    update((d) => {
      const index = d.socials.findIndex((social) => social.id === id)
      if (index >= 0) d.socials[index] = { ...d.socials[index], ...patch }
      return d
    })

  const moveSocial = (from: number, to: number) =>
    update((d) => {
      if (to < 0 || to >= d.socials.length) return d
      const [moved] = d.socials.splice(from, 1)
      d.socials.splice(to, 0, moved)
      return d
    })

  const socialSortable = useSortable(moveSocial)

  const addSocial = () =>
    update((d) => {
      d.socials.push({ id: makeId('soc'), label: '', handle: '', url: '' })
      return d
    })

  const removeSocial = async (social: SocialLink, index: number) => {
    const yes = await confirm({
      title: `Remover “${social.label || 'rede'}”?`,
      description: 'O link sai do rodapé e da seção de contato.',
      confirmLabel: 'Remover',
      tone: 'danger',
    })
    if (!yes) return
    update((d) => {
      d.socials.splice(index, 1)
      return d
    })
    toast.info('Rede removida.', {
      action: {
        label: 'Desfazer',
        onClick: () =>
          update((d) => {
            d.socials.splice(index, 0, social)
            return d
          }),
      },
    })
  }

  const byCategory = useMemo(() => {
    const groups = new Map<Category, TechItem[]>()
    for (const category of CATEGORIES) groups.set(category, [])
    for (const tech of draft.techStack) groups.get(tech.category)?.push(tech)
    return groups
  }, [draft.techStack])

  if (loading) {
    return (
      <>
        <PageHeader title="Perfil & Stack" subtitle="Carregando o conteúdo publicado…" />
        <Skeleton className="h-64" />
      </>
    )
  }

  const emailInvalid = !isValidEmail(profile.email)
  const githubInvalid = !isValidUrl(profile.github)

  return (
    <>
      <PageHeader
        title="Perfil & Stack"
        subtitle="Identidade, biografia, disponibilidade, tecnologias e redes sociais."
        meta={
          <>
            <Badge tone={profile.available ? 'ember' : 'muted'}>
              {profile.available ? 'disponível para projetos' : 'indisponível'}
            </Badge>
            <span className="font-mono text-[10px] tracking-[0.16em] text-smoke uppercase">
              {draft.techStack.length} tecnologias · {draft.socials.length} redes
            </span>
          </>
        }
      />

      {/* ─── Identidade ──────────────────────────────────────── */}
      <Card className="mb-6">
        <SectionHeader
          label="Identidade"
          hint="Estes campos alimentam o hero, o rodapé, o schema.org e os metadados sociais."
        />

        <div className="grid gap-6 lg:grid-cols-[13rem_1fr] lg:items-start">
          <div>
            <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-smoke uppercase">
              Avatar
            </p>
            <div className="aspect-square w-full max-w-[13rem] overflow-hidden border border-line bg-ink">
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-center text-xs text-smoke">
                  sem avatar
                </div>
              )}
            </div>
            <Field
              label="URL do avatar"
              className="mt-3"
              hint="Serve um WebP local (/portrait-640.webp) em vez do PNG do GitHub."
            >
              <TextInput
                value={profile.avatar}
                onChange={(event) => setProfile({ avatar: event.target.value })}
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome (curto)" required>
              <TextInput
                value={profile.name}
                onChange={(event) => setProfile({ name: event.target.value })}
              />
            </Field>
            <Field label="Nome completo">
              <TextInput
                value={profile.fullName}
                onChange={(event) => setProfile({ fullName: event.target.value })}
              />
            </Field>
            <Field label="Cargo / título" required>
              <TextInput
                value={profile.role}
                onChange={(event) => setProfile({ role: event.target.value })}
              />
            </Field>
            <Field
              label={
                <span className="flex items-center gap-2">
                  E-mail
                  <CopyButton value={profile.email} label="copiar" />
                </span>
              }
              error={emailInvalid ? 'E-mail inválido' : null}
            >
              <TextInput
                type="email"
                value={profile.email}
                invalid={emailInvalid}
                onChange={(event) => setProfile({ email: event.target.value })}
              />
            </Field>
            <Field label="Localização">
              <TextInput
                value={profile.location}
                onChange={(event) => setProfile({ location: event.target.value })}
              />
            </Field>
            <Field label="Localização (curta)" hint="Ex.: ES — BRA">
              <TextInput
                value={profile.locationShort}
                onChange={(event) => setProfile({ locationShort: event.target.value })}
              />
            </Field>
            <Field
              label={
                <span className="flex items-center gap-2">
                  GitHub (URL)
                  {!githubInvalid && (
                    <a
                      href={profile.github}
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
              error={githubInvalid ? 'Inclua https:// no começo' : null}
            >
              <TextInput
                value={profile.github}
                invalid={githubInvalid}
                onChange={(event) => setProfile({ github: event.target.value })}
              />
            </Field>
            <Field label="Nº de repositórios" hint="Exibido como estatística no site">
              <TextInput
                type="number"
                min={0}
                value={String(profile.repoCount)}
                onChange={(event) =>
                  setProfile({ repoCount: Number(event.target.value) || 0 })
                }
              />
            </Field>
            <div className="flex items-end md:col-span-2">
              <Toggle
                checked={profile.available}
                onChange={(on) => setProfile({ available: on })}
                label="Disponível para projetos"
                hint="Controla o sinal “open to work” no hero."
              />
            </div>
          </div>
        </div>

        <div className="mt-5">
          <Field
            label="Bio"
            counter={[profile.bio.length, 320]}
            hint="Usada na seção Sobre e na meta description da home."
          >
            <TextArea
              value={profile.bio}
              className="min-h-28"
              onChange={(event) => setProfile({ bio: event.target.value })}
            />
          </Field>
        </div>
      </Card>

      {/* ─── Tecnologias ─────────────────────────────────────── */}
      <Card className="mb-6">
        <SectionHeader
          label={`Tecnologias (${draft.techStack.length})`}
          hint="A ordem dentro de cada categoria é a ordem exibida na seção Stack."
          action={
            <Segmented
              size="sm"
              label="Filtrar por categoria"
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[
                { value: 'all', label: 'Todas', count: draft.techStack.length },
                ...CATEGORIES.map((category) => ({
                  value: category,
                  label: CATEGORY_LABEL[category],
                  count: byCategory.get(category)?.length ?? 0,
                })),
              ]}
            />
          }
        />

        <div className="flex flex-col gap-6">
          {CATEGORIES.filter(
            (category) => categoryFilter === 'all' || categoryFilter === category,
          ).map((category) => {
            const items = byCategory.get(category) ?? []
            return (
              <div key={category}>
                <div className="mb-2 flex items-center justify-between gap-3 border-b border-line pb-2">
                  <p className="font-mono text-[10px] tracking-[0.2em] text-smoke uppercase">
                    {CATEGORY_LABEL[category]}{' '}
                    <span className="text-smoke/60">({items.length})</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => addTech(category)}
                    className={cn(
                      'font-mono text-[10px] tracking-[0.16em] text-ember uppercase hover:underline',
                      focusRing,
                    )}
                  >
                    + adicionar
                  </button>
                </div>

                {items.length === 0 ? (
                  <p className="py-2 text-xs text-smoke">Nada nesta categoria ainda.</p>
                ) : (
                  <ul className="flex flex-col">
                    {items.map((tech) => {
                      const index = draft.techStack.indexOf(tech)
                      return (
                        <li
                          key={tech.id}
                          {...techSortable.rowProps(index)}
                          className={cn(
                            'flex items-center gap-2 border-b border-line/60 py-2',
                            techSortable.rowClass(index),
                          )}
                        >
                          <DragHandle {...techSortable.handleProps(index)} />
                          <TextInput
                            value={tech.name}
                            placeholder="Nome da tecnologia"
                            invalid={!tech.name.trim()}
                            onChange={(event) =>
                              setTech(tech.id!, { name: event.target.value })
                            }
                            className="flex-1"
                          />
                          <Select
                            value={tech.category}
                            aria-label="Categoria"
                            onChange={(event) =>
                              setTech(tech.id!, {
                                category: event.target.value as Category,
                              })
                            }
                            className="w-36"
                          >
                            {CATEGORIES.map((option) => (
                              <option key={option} value={option}>
                                {CATEGORY_LABEL[option]}
                              </option>
                            ))}
                          </Select>
                          <MoveButtons
                            index={index}
                            total={draft.techStack.length}
                            onMove={moveTech}
                          />
                          <IconButton
                            size="sm"
                            label="Remover"
                            variant="danger"
                            onClick={() => removeTech(tech, index)}
                          >
                            ✕
                          </IconButton>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {/* ─── Redes ───────────────────────────────────────────── */}
      <Card>
        <SectionHeader
          label={`Redes sociais (${draft.socials.length})`}
          hint="Rodapé e seção de contato, na ordem desta lista."
          action={
            <AdminButton variant="outline" size="sm" onClick={addSocial}>
              + Rede
            </AdminButton>
          }
        />

        {draft.socials.length === 0 ? (
          <p className="text-sm text-smoke">Nenhuma rede cadastrada.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {draft.socials.map((social, index) => {
              const issues = socialIssues(social)
              return (
                <li
                  key={social.id}
                  {...socialSortable.rowProps(index)}
                  className={cn(
                    'grid gap-3 border-b border-line/60 pb-4 last:border-0 last:pb-0 md:grid-cols-[auto_1fr_1fr_1.6fr_auto] md:items-end',
                    socialSortable.rowClass(index),
                  )}
                >
                  <div className="flex items-center gap-1 md:pb-2.5">
                    <DragHandle {...socialSortable.handleProps(index)} />
                  </div>
                  <Field label="Rótulo" required>
                    <TextInput
                      value={social.label}
                      invalid={!social.label.trim()}
                      onChange={(event) => setSocial(social.id!, { label: event.target.value })}
                    />
                  </Field>
                  <Field label="Handle">
                    <TextInput
                      value={social.handle}
                      placeholder="@usuario"
                      onChange={(event) =>
                        setSocial(social.id!, { handle: event.target.value })
                      }
                    />
                  </Field>
                  <Field
                    label={
                      <span className="flex items-center gap-2">
                        URL
                        {isValidUrl(social.url) && (
                          <a
                            href={social.url}
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
                      issues.includes('URL inválida') ? 'Inclua https:// no começo' : null
                    }
                  >
                    <TextInput
                      value={social.url}
                      invalid={issues.includes('URL inválida')}
                      onChange={(event) => setSocial(social.id!, { url: event.target.value })}
                    />
                  </Field>
                  <div className="flex items-center gap-1 md:pb-1">
                    <MoveButtons
                      index={index}
                      total={draft.socials.length}
                      onMove={moveSocial}
                    />
                    <IconButton
                      size="sm"
                      label="Remover"
                      variant="danger"
                      onClick={() => void removeSocial(social, index)}
                    >
                      ✕
                    </IconButton>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <SaveBar />
    </>
  )
}
