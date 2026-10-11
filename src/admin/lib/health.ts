import type { Post, PostMeta } from '@/blog/types'
import type {
  ExperienceProject,
  Project,
  SiteContent,
  SiteProfile,
  SocialLink,
} from '@/content/types'

/**
 * Content checks, in one place.
 *
 * The admin can save anything — that is deliberate, a half-written project is a
 * legitimate work in progress. What it should not do is let a gap reach the
 * public site *silently*. These functions are the shared answer to "is anything
 * unfinished?", used three ways: per-item warnings in the editors, the
 * dashboard's attention panel, and the publish checklist in the post editor.
 *
 * Severity means: `blocker` breaks something a visitor sees, `warn` degrades
 * the page or its SEO, `info` is worth knowing before publishing.
 */

export type Severity = 'blocker' | 'warn' | 'info'

export interface Issue {
  id: string
  label: string
  /** Admin route that fixes it. */
  to: string
  severity: Severity
}

/* ─── Field-level predicates ────────────────────────────────────────────── */

export function isValidUrl(value: string): boolean {
  if (!value.trim()) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function isValidEmail(value: string): boolean {
  // Deliberately loose: the only failure worth catching here is a typo like a
  // missing @ or a trailing comma. Anything stricter rejects valid addresses.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}

/** `YYYY-MM`, the format the public timeline parses. */
export function isValidYearMonth(value: string): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false
  const year = Number(value.slice(0, 4))
  return year >= 1990 && year <= new Date().getFullYear() + 5
}

/* ─── Item-level checks ─────────────────────────────────────────────────── */

export function projectIssues(project: Project): string[] {
  const issues: string[] = []
  if (!project.title.trim() || project.title === 'Novo projeto') {
    issues.push('sem título definitivo')
  }
  if (!project.description.pt.trim()) issues.push('descrição PT vazia')
  if (!project.description.en.trim()) issues.push('descrição EN vazia')
  if (project.stack.length === 0) issues.push('sem stack')
  if (!project.url.trim()) issues.push('sem link')
  else if (!isValidUrl(project.url)) issues.push('link inválido')
  if (!/^\d{4}$/.test(project.year)) issues.push('ano fora do formato AAAA')
  return issues
}

export function experienceIssues(entry: ExperienceProject): string[] {
  const issues: string[] = []
  if (!entry.client.trim() || entry.client === 'Novo cliente') {
    issues.push('sem cliente definitivo')
  }
  if (!entry.title.pt.trim()) issues.push('título PT vazio')
  if (!entry.title.en.trim()) issues.push('título EN vazio')
  if (!entry.sector.pt.trim() || !entry.sector.en.trim()) issues.push('setor incompleto')
  if (!entry.scope.pt.trim() || !entry.scope.en.trim()) issues.push('escopo incompleto')
  if (entry.stack.length === 0) issues.push('sem stack')
  return issues
}

export function socialIssues(social: SocialLink): string[] {
  const issues: string[] = []
  if (!social.label.trim()) issues.push('sem rótulo')
  if (!social.url.trim()) issues.push('sem URL')
  else if (!isValidUrl(social.url)) issues.push('URL inválida')
  return issues
}

export function profileIssues(profile: SiteProfile): string[] {
  const issues: string[] = []
  if (!profile.name.trim()) issues.push('nome vazio')
  if (!profile.role.trim()) issues.push('cargo vazio')
  if (!isValidEmail(profile.email)) issues.push('e-mail inválido')
  if (!isValidUrl(profile.github)) issues.push('GitHub inválido')
  if (!profile.avatar.trim()) issues.push('avatar vazio')
  if (profile.bio.trim().length < 40) issues.push('bio muito curta')
  return issues
}

/* ─── Site-wide roll-up, for the dashboard ──────────────────────────────── */

export function siteIssues(content: SiteContent): Issue[] {
  const issues: Issue[] = []

  for (const problem of profileIssues(content.profile)) {
    issues.push({
      id: `profile:${problem}`,
      label: `Perfil: ${problem}`,
      to: '/admin/profile',
      severity: problem.includes('inválido') ? 'blocker' : 'warn',
    })
  }

  content.projects.forEach((project, index) => {
    const problems = projectIssues(project)
    if (problems.length === 0) return
    issues.push({
      id: `project:${project.id ?? index}`,
      label: `Projeto “${project.title || index + 1}”: ${problems.join(', ')}`,
      to: '/admin/projects',
      severity: problems.some((p) => p.includes('inválido')) ? 'blocker' : 'warn',
    })
  })

  content.experience.projects.forEach((entry, index) => {
    const problems = experienceIssues(entry)
    if (problems.length === 0) return
    issues.push({
      id: `experience:${entry.id ?? index}`,
      label: `Carreira “${entry.client || index + 1}”: ${problems.join(', ')}`,
      to: '/admin/experience',
      severity: 'warn',
    })
  })

  content.socials.forEach((social, index) => {
    const problems = socialIssues(social)
    if (problems.length === 0) return
    issues.push({
      id: `social:${social.id ?? index}`,
      label: `Rede “${social.label || index + 1}”: ${problems.join(', ')}`,
      to: '/admin/profile',
      severity: 'warn',
    })
  })

  if (!isValidYearMonth(content.experience.start)) {
    issues.push({
      id: 'experience:start',
      label: 'Carreira: data de início fora do formato AAAA-MM',
      to: '/admin/experience',
      severity: 'blocker',
    })
  }
  if (content.experience.end !== null && !isValidYearMonth(content.experience.end)) {
    issues.push({
      id: 'experience:end',
      label: 'Carreira: data de fim fora do formato AAAA-MM (ou marque “em andamento”)',
      to: '/admin/experience',
      severity: 'blocker',
    })
  }
  if (content.techStack.length === 0) {
    issues.push({
      id: 'stack:empty',
      label: 'Stack sem nenhuma tecnologia',
      to: '/admin/profile',
      severity: 'warn',
    })
  }

  return issues
}

/** Posts with metadata gaps that hurt how they are shared or indexed. */
export function postIssues(posts: PostMeta[]): Issue[] {
  const issues: Issue[] = []
  for (const post of posts) {
    if (post.status !== 'published') continue
    const problems: string[] = []
    if (!post.excerpt.trim()) problems.push('sem resumo')
    if (!post.cover) problems.push('sem capa')
    else if (!post.cover.alt.trim()) problems.push('capa sem texto alternativo')
    if (post.tags.length === 0) problems.push('sem tags')
    if (problems.length === 0) continue
    issues.push({
      id: `post:${post.slug}`,
      label: `Post “${post.title}”: ${problems.join(', ')}`,
      to: `/admin/blog/${post.slug}`,
      severity: 'warn',
    })
  }
  return issues
}

/* ─── Publish checklist, for the post editor ────────────────────────────── */

export interface Check {
  label: string
  ok: boolean
  hint?: string
}

/**
 * What "ready to publish" means for a post.
 *
 * Not a gate — the Salvar button never waits on it. It is the list you glance
 * at before flipping the status, so the thing that reaches LinkedIn has a
 * title, a description and an image.
 */
export function publishChecklist(post: Post): Check[] {
  const titleLength = post.title.trim().length
  const excerpt = post.excerpt.trim()
  const bodyWords = post.body.trim() ? post.body.trim().split(/\s+/).length : 0

  return [
    {
      label: 'Título entre 20 e 70 caracteres',
      ok: titleLength >= 20 && titleLength <= 70,
      hint: `${titleLength} caracteres — abaixo de 20 rende pouco no Google, acima de 70 é cortado.`,
    },
    {
      label: 'Slug curto e legível',
      ok: post.slug.length > 0 && post.slug.length <= 60,
      hint: post.slug ? `/blog/${post.slug}` : 'Defina o título para gerar o slug.',
    },
    {
      label: 'Resumo escrito à mão',
      ok: excerpt.length >= 60 && excerpt.length <= 200,
      hint: `${excerpt.length}/200 — é a meta description e o texto do card. Vazio gera um automático.`,
    },
    {
      label: 'Capa com texto alternativo',
      ok: Boolean(post.cover && post.cover.alt.trim()),
      hint: post.cover
        ? 'A capa existe; descreva a imagem para leitores de tela e para o OG.'
        : 'Sem capa, o compartilhamento sai sem imagem.',
    },
    {
      label: 'Pelo menos uma tag',
      ok: post.tags.length > 0,
      hint: 'As tags alimentam os filtros do índice.',
    },
    {
      label: 'Corpo com mais de 150 palavras',
      ok: bodyWords >= 150,
      hint: `${bodyWords} palavras.`,
    },
    {
      label: 'Pelo menos um subtítulo (##)',
      ok: /^##\s/m.test(post.body),
      hint: 'Os títulos de seção montam o índice lateral do post.',
    },
  ]
}
