import { createContext, useContext } from 'react'

import type { Locale } from '@/i18n/translations'

export interface PostAlternateTarget {
  lang: Locale
  path: string
}

export interface BlogLocaleSwitchValue {
  /** Reads the currently rendered post's alternate language target, if any. */
  getAlternate: () => PostAlternateTarget | null
  /** Registered by `BlogPost` so `BlogHeader` switches route + locale atomically. */
  setAlternate: (target: PostAlternateTarget | null) => void
}

const noop = () => {}

export const BlogLocaleSwitchContext = createContext<BlogLocaleSwitchValue>({
  getAlternate: () => null,
  setAlternate: noop,
})

export function useBlogLocaleSwitch() {
  return useContext(BlogLocaleSwitchContext)
}
