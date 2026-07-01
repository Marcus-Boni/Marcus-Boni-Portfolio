import type { SiteContent } from './types'

let counter = 0

/** Short, collision-resistant client id for editor list keys. */
export function makeId(prefix = 'id'): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`
}

/**
 * Guarantee every collection item carries a stable `id`. Idempotent — items
 * that already have one are left untouched. Mutates and returns the input.
 */
export function ensureContentIds(content: SiteContent): SiteContent {
  content.projects.forEach((p) => {
    if (!p.id) p.id = makeId('proj')
  })
  content.experience.projects.forEach((e) => {
    if (!e.id) e.id = makeId('exp')
  })
  content.techStack.forEach((t) => {
    if (!t.id) t.id = makeId('tech')
  })
  content.socials.forEach((s) => {
    if (!s.id) s.id = makeId('soc')
  })
  return content
}
