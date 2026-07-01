import {
  experience,
  profile,
  projects,
  socials,
  techStack,
} from '@/data/profile'

import { ensureContentIds } from './ids'
import type { SiteContent } from './types'

/**
 * The static `profile.ts` data, reshaped into the editable `SiteContent` form.
 * This is what the public site renders before Firestore hydrates (or forever,
 * if Firebase is never configured) and the seed the admin "Reset to defaults"
 * action writes back.
 */
export const defaultSiteContent: SiteContent = {
  profile: {
    name: profile.name,
    fullName: profile.fullName,
    role: profile.role,
    location: profile.location,
    locationShort: profile.locationShort,
    email: profile.email,
    github: profile.github,
    avatar: profile.avatar,
    bio: profile.bio,
    repoCount: profile.repoCount,
    available: true,
  },
  // structuredClone keeps the editable copy from mutating the frozen statics.
  projects: structuredClone(projects),
  experience: structuredClone(experience),
  techStack: structuredClone(techStack),
  socials: structuredClone(socials),
}

/** Deep-ish clone helper for seeding editable form state from defaults. */
export function cloneDefaultContent(): SiteContent {
  return ensureContentIds(structuredClone(defaultSiteContent))
}
