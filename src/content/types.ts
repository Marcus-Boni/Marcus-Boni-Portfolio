import type {
  Experience,
  ExperienceProject,
  Project,
  SocialLink,
  TechItem,
} from '@/data/profile'

/** Editable mirror of the static `profile` object, plus an availability flag. */
export interface SiteProfile {
  name: string
  fullName: string
  role: string
  location: string
  locationShort: string
  email: string
  github: string
  avatar: string
  bio: string
  repoCount: number
  /** Drives the "open to projects" signal on the public hero. */
  available: boolean
}

/**
 * The full editable portfolio payload. Stored as a single Firestore document
 * (`content/site`) — small enough to fetch in one snapshot, atomic to write.
 */
export interface SiteContent {
  profile: SiteProfile
  projects: Project[]
  experience: Experience
  techStack: TechItem[]
  socials: SocialLink[]
  /** Last write time, ISO string. Set by the admin on save. */
  updatedAt?: string
}

export type { Experience, ExperienceProject, Project, SocialLink, TechItem }
