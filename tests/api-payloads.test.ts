import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { experience, profile, projects, socials, techStack } from '@/data/profile'
import { apiExperience, apiProfile, apiProjects, apiStack, staticPayloads } from '@/data/api'
import { openApiDocument } from '@/data/openapi'

/**
 * Generates the static API payloads, and fails when they go stale.
 *
 * `toMatchFileSnapshot` is doing real work here, not just asserting: the
 * snapshot targets are the files Netlify actually serves — `public/api/v1/*.json`
 * and `public/openapi.json`. Editing `src/data/profile.ts` and forgetting to
 * regenerate fails the suite, and the Netlify build runs the suite, so a stale
 * payload cannot reach production.
 *
 *     pnpm test -u     # regenerate after changing profile.ts
 *
 * That keeps `profile.ts` the single source of truth without adding a build
 * step, a generator script or a committed-but-unverified artefact.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicFile = (relative: string) => path.join(root, 'public', relative)

/** Two-space JSON with a trailing newline — what a formatter would leave. */
const serialise = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

describe('static API payloads', () => {
  it.each(Object.entries(staticPayloads()))(
    'writes %s',
    async (endpointPath, payload) => {
      // `/api/v1/profile.json` → `public/api/v1/profile.json`
      await expect(serialise(payload)).toMatchFileSnapshot(
        publicFile(endpointPath.replace(/^\//, '')),
      )
    },
  )

  it('writes openapi.json', async () => {
    await expect(serialise(openApiDocument())).toMatchFileSnapshot(
      publicFile('openapi.json'),
    )
  })
})

describe('payload content', () => {
  it('reports the profile that profile.ts holds', () => {
    const payload = apiProfile()
    expect(payload.name).toBe(profile.name)
    expect(payload.fullName).toBe(profile.fullName)
    expect(payload.email).toBe(profile.email)
    expect(payload.repositoryCount).toBe(profile.repoCount)
    expect(payload.employer.company).toBe(experience.company)
    expect(payload.employer.current).toBe(experience.end === null)
    expect(payload.links).toHaveLength(socials.length)
  })

  it('splits the location into region and country', () => {
    const payload = apiProfile()
    expect(`${payload.location.region}, ${payload.location.country}`).toBe(profile.location)
  })

  it('exposes every project with a fetchable repository URL', () => {
    const payload = apiProjects()
    expect(payload.count).toBe(projects.length)
    expect(payload.items.map((item) => item.title)).toEqual(projects.map((p) => p.title))
    for (const item of payload.items) {
      expect(item.repositoryUrl).toMatch(/^https:\/\//)
      expect(item.description.pt.length).toBeGreaterThan(0)
      expect(item.description.en.length).toBeGreaterThan(0)
    }
  })

  it('exposes every client engagement with its sector and scope', () => {
    const payload = apiExperience()
    expect(payload.engagements).toHaveLength(experience.projects.length)
    expect(payload.engagements.map((e) => e.client)).toEqual(
      experience.projects.map((e) => e.client),
    )
    for (const engagement of payload.engagements) {
      expect(engagement.sector.en.length).toBeGreaterThan(0)
      expect(engagement.scope.en.length).toBeGreaterThan(0)
    }
  })

  it('exposes the whole stack, categorised', () => {
    const payload = apiStack()
    expect(payload.count).toBe(techStack.length)
    for (const item of payload.items) {
      expect(['frontend', 'backend', 'data', 'ops']).toContain(item.category)
    }
  })

  it('serialises to absolute URLs, never site-relative paths', () => {
    // A client that fetched the JSON has no base to resolve `/x.pdf` against.
    const json = JSON.stringify([apiProfile(), apiProjects(), apiExperience()])
    const relative = [...json.matchAll(/"(\/[a-z0-9][^"]*)"/gi)].map((m) => m[1])
    expect(relative).toEqual([])
  })
})

describe('committed payloads match the rewrites', () => {
  const redirects = readFileSync(path.join(root, 'public/_redirects'), 'utf8')

  it.each(Object.keys(staticPayloads()))('routes %s', (endpointPath) => {
    // `/api/v1/profile.json` is the file; `/api/v1/profile` is the documented
    // endpoint, and only exists if `_redirects` says so.
    const documented = endpointPath.replace(/(\/index)?\.json$/, '')
    const rule = redirects
      .split('\n')
      .map((line) => line.trim().split(/\s+/))
      .find(([from]) => from === documented)

    expect(rule, `no rewrite for ${documented}`).toBeDefined()
    expect(rule?.[1]).toBe(endpointPath)
    expect(rule?.[2]).toBe('200')
  })
})
