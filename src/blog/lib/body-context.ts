import { createContext, useContext } from 'react'

import { translations, type Locale } from '@/i18n/translations'

/**
 * What the blocks inside an article need to know about the page around them.
 *
 * `PostBody` also renders in the admin preview and in tests, outside the
 * `LanguageProvider`, so the body cannot call `useLanguage`. It does not want
 * to anyway: a label inside an article follows the language the post was
 * written in, which is not always the language the interface is set to.
 */
export interface BodyEnvironment {
  lang: Locale
  /**
   * True when the layout around the body has a margin column. Notes and wide
   * blocks only reach into it when the page says it is there; the editor's
   * preview pane has none.
   */
  margin: boolean
}

export const BodyContext = createContext<BodyEnvironment>({ lang: 'pt', margin: false })

export function useBodyLabels() {
  return translations[useContext(BodyContext).lang].blog.body
}

/** Lines the surrounding walkthrough wants lit in the code block it pins. */
export const StageContext = createContext<Set<number> | null>(null)
