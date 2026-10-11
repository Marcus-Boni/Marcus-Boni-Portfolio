import { ensureContentIds } from '@/content/ids'
import type { SiteContent } from '@/content/types'

/**
 * Content backup: one JSON file that round-trips the whole editable payload.
 *
 * Shared by the Ajustes page and the command palette, because "export before I
 * touch anything" is the action you want reachable without navigating first.
 */

export function exportContentJson(content: SiteContent): string {
  const stamp = new Date().toISOString().slice(0, 10)
  const name = `portfolio-content-${stamp}.json`
  const blob = new Blob([JSON.stringify(content, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
  return name
}

export interface ImportPreview {
  content: SiteContent
  /** Human-readable "what will change" rows, shown before applying. */
  changes: { label: string; from: number | string; to: number | string }[]
}

/**
 * Validates a pasted or dropped export and describes the diff.
 *
 * Throws with a message meant to be shown verbatim — the alternative is the
 * previous behaviour, where every failure collapsed into "JSON inválido" and
 * you had to guess which key was wrong.
 */
export function parseContentJson(text: string, current: SiteContent): ImportPreview {
  let parsed: Partial<SiteContent>
  try {
    parsed = JSON.parse(text) as Partial<SiteContent>
  } catch {
    throw new Error('Não é um JSON válido. Verifique o arquivo ou o texto colado.')
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('O JSON precisa ser um objeto com as chaves do conteúdo.')
  }
  if (!parsed.profile || typeof parsed.profile !== 'object') {
    throw new Error('Falta a chave "profile" — este arquivo não é um export do portfólio.')
  }
  for (const key of ['projects', 'techStack', 'socials'] as const) {
    if (parsed[key] !== undefined && !Array.isArray(parsed[key])) {
      throw new Error(`A chave "${key}" precisa ser uma lista.`)
    }
  }
  if (
    parsed.experience !== undefined &&
    (typeof parsed.experience !== 'object' ||
      !Array.isArray(parsed.experience?.projects))
  ) {
    throw new Error('A chave "experience" precisa conter uma lista "projects".')
  }

  const content = ensureContentIds({
    profile: { ...current.profile, ...parsed.profile },
    projects: parsed.projects ?? current.projects,
    experience: parsed.experience ?? current.experience,
    techStack: parsed.techStack ?? current.techStack,
    socials: parsed.socials ?? current.socials,
    updatedAt: current.updatedAt,
  })

  return {
    content,
    changes: [
      { label: 'Nome', from: current.profile.name, to: content.profile.name },
      { label: 'Projetos', from: current.projects.length, to: content.projects.length },
      {
        label: 'Experiências',
        from: current.experience.projects.length,
        to: content.experience.projects.length,
      },
      { label: 'Tecnologias', from: current.techStack.length, to: content.techStack.length },
      { label: 'Redes', from: current.socials.length, to: content.socials.length },
    ],
  }
}
