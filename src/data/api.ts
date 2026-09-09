import {
  cvFiles,
  experience,
  profile,
  projects,
  socials,
  techStack,
  type TechItem,
} from '@/data/profile'

/**
 * The public read-only JSON API's payloads.
 *
 * Derived from `profile.ts` at build time rather than restated, which is the
 * whole point: `netlify/lib/agent-docs.ts` already keeps a hand-written prose
 * copy of this content and needs drift tests to stay honest. A third copy,
 * this one structured and typed, would have been one too many.
 *
 * `scripts/vite-plugin-api.ts` calls these during `vite build` and writes the
 * results into `dist/api/v1/*.json`. Nothing here runs at request time, so the
 * endpoints cost a static file read and no compute.
 *
 * The blog is the exception: posts live in Firestore and change without a
 * rebuild, so `/api/v1/posts` is served by `netlify/edge-functions/api.ts`.
 */

const SITE_URL = 'https://marcusboni.com.br'

/** Text that exists in both site languages. */
export interface Localized {
  pt: string
  en: string
}

export interface ApiProfile {
  name: string
  fullName: string
  role: string
  employer: { company: string; role: string; since: string; current: boolean }
  location: { region: string; country: string }
  email: string
  bio: Localized
  repositoryCount: number
  languages: string[]
  links: { label: string; handle: string; url: string }[]
  resumes: { language: 'pt-BR' | 'en'; url: string }[]
}

export interface ApiProject {
  id: string
  title: string
  year: string
  description: Localized
  stack: string[]
  repositoryUrl: string
}

export interface ApiEngagement {
  id: string
  client: string
  project: Localized
  sector: Localized
  scope: Localized
  stack: string[]
}

export interface ApiExperience {
  role: string
  company: string
  startedAt: string
  endedAt: string | null
  current: boolean
  engagements: ApiEngagement[]
}

export interface ApiTechnology {
  name: string
  category: TechItem['category']
}

/** Collections answer with a count so a client can page-check without parsing. */
export interface ApiCollection<T> {
  count: number
  items: T[]
}

function absolute(pathname: string): string {
  return `${SITE_URL}${pathname}`
}

export function apiProfile(): ApiProfile {
  const [region, country] = profile.location.split(', ')
  return {
    name: profile.name,
    fullName: profile.fullName,
    role: profile.role,
    employer: {
      company: experience.company,
      role: experience.role,
      since: experience.start,
      current: experience.end === null,
    },
    location: { region, country },
    email: profile.email,
    bio: {
      pt: profile.bio,
      en: 'Brazilian web developer focused on building robust, modern applications.',
    },
    repositoryCount: profile.repoCount,
    languages: ['pt-BR', 'en'],
    links: socials.map(({ label, handle, url }) => ({ label, handle, url })),
    resumes: [
      { language: 'pt-BR', url: absolute(cvFiles.pt) },
      { language: 'en', url: absolute(cvFiles.en) },
    ],
  }
}

export function apiProjects(): ApiCollection<ApiProject> {
  const items = projects.map<ApiProject>((project) => ({
    // `index` is the editorial numbering shown on the site ("01"…); it is the
    // only stable identifier these entries have.
    id: project.index,
    title: project.title,
    year: project.year,
    description: project.description,
    stack: [...project.stack],
    repositoryUrl: project.url,
  }))
  return { count: items.length, items }
}

export function apiExperience(): ApiExperience {
  return {
    role: experience.role,
    company: experience.company,
    startedAt: experience.start,
    endedAt: experience.end,
    current: experience.end === null,
    engagements: experience.projects.map<ApiEngagement>((entry) => ({
      id: entry.id,
      client: entry.client,
      project: entry.title,
      sector: entry.sector,
      scope: entry.scope,
      stack: [...entry.stack],
    })),
  }
}

export function apiStack(): ApiCollection<ApiTechnology> {
  const items = techStack.map<ApiTechnology>(({ name, category }) => ({ name, category }))
  return { count: items.length, items }
}

/** Operation index, so `/api/v1` is a usable entry point rather than a 404. */
export function apiIndex(): {
  name: string
  description: string
  version: string
  documentation: string
  openapi: string
  endpoints: { method: string; path: string; operationId: string; summary: string }[]
} {
  return {
    name: 'Marcus Boni — public content API',
    description:
      'Read-only JSON representations of the content published on marcusboni.com.br. ' +
      'No authentication, no rate limit, no write operations.',
    version: API_VERSION,
    documentation: absolute('/developers'),
    openapi: absolute('/openapi.json'),
    endpoints: OPERATIONS.map(({ method, path, operationId, summary }) => ({
      method,
      path,
      operationId,
      summary,
    })),
  }
}

export const API_VERSION = '1.0.0'
export const API_BASE = '/api/v1'

/**
 * Minimum days between announcing a deprecation and the path going away.
 *
 * Duplicated in `netlify/lib/deprecation.ts`, which is where it is enforced —
 * the edge runtime cannot import from `src/`. `tests/deprecation.test.ts`
 * asserts the two agree, so the number the specification publishes is the
 * number the headers honour.
 */
export const MINIMUM_NOTICE_DAYS = 180

/**
 * Every operation the API exposes, in one list.
 *
 * `scripts/vite-plugin-api.ts` writes a file for each `static` entry, the
 * OpenAPI document is generated from the same list, and `tests/openapi.test.ts`
 * checks the three agree. An endpoint cannot be documented without existing, or
 * exist without being documented.
 */
export interface Operation {
  method: 'GET'
  path: string
  operationId: string
  summary: string
  description: string
  /** `static` entries are emitted as JSON at build time; `live` ones are edge. */
  kind: 'static' | 'live'
  /** Response schema name in `components.schemas`. */
  schema: string
}

export const OPERATIONS: readonly Operation[] = [
  {
    method: 'GET',
    path: `${API_BASE}`,
    operationId: 'getApiIndex',
    summary: 'List the available operations',
    description:
      'Returns the API version, a link to the OpenAPI document, and every operation this API exposes. Use it to discover the surface without parsing the specification.',
    kind: 'static',
    schema: 'ApiIndex',
  },
  {
    method: 'GET',
    path: `${API_BASE}/profile`,
    operationId: 'getProfile',
    summary: 'Get the profile of Marcus Boni',
    description:
      'Identity, current employer, location, public contact channels and résumé links. Use this to answer who the site belongs to and how to reach them.',
    kind: 'static',
    schema: 'Profile',
  },
  {
    method: 'GET',
    path: `${API_BASE}/projects`,
    operationId: 'listProjects',
    summary: 'List selected personal projects',
    description:
      'The projects featured on the site, each with its year, technology stack, bilingual description and public repository URL.',
    kind: 'static',
    schema: 'ProjectCollection',
  },
  {
    method: 'GET',
    path: `${API_BASE}/experience`,
    operationId: 'getExperience',
    summary: 'Get professional experience and client engagements',
    description:
      'The current role plus every client engagement delivered, each with its sector, scope and stack. Use this to check whether specific industry or technology experience exists.',
    kind: 'static',
    schema: 'Experience',
  },
  {
    method: 'GET',
    path: `${API_BASE}/stack`,
    operationId: 'listTechnologies',
    summary: 'List the technologies worked with',
    description:
      'Every technology on the site, grouped by category: frontend, backend, data or ops.',
    kind: 'static',
    schema: 'TechnologyCollection',
  },
  {
    method: 'GET',
    path: `${API_BASE}/posts`,
    operationId: 'listPosts',
    summary: 'List published blog posts',
    description:
      'Metadata for every published post, newest first. Served live from the database, so a post appears here as soon as it is published.',
    kind: 'live',
    schema: 'PostCollection',
  },
  {
    method: 'GET',
    path: `${API_BASE}/posts/{slug}`,
    operationId: 'getPost',
    summary: 'Get one blog post with its Markdown body',
    description:
      'A single post by slug, including the Markdown source it was authored in. Returns 404 when no published post has that slug.',
    kind: 'live',
    schema: 'Post',
  },
]

/** The build-time payload for each `static` operation, keyed by output path. */
export function staticPayloads(): Record<string, unknown> {
  return {
    [`${API_BASE}/index.json`]: apiIndex(),
    [`${API_BASE}/profile.json`]: apiProfile(),
    [`${API_BASE}/projects.json`]: apiProjects(),
    [`${API_BASE}/experience.json`]: apiExperience(),
    [`${API_BASE}/stack.json`]: apiStack(),
  }
}
