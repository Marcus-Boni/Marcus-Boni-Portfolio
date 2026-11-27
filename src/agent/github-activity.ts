import type {
  GitHubActivityPayload,
  GitHubReleaseItem,
  GitHubRepoActivity,
} from '../../netlify/lib/github-activity'

export type { GitHubActivityPayload, GitHubReleaseItem, GitHubRepoActivity }

/**
 * Client-side session-cached fetcher for `/agent/v1/github`.
 *
 * Non-blocking and silent on error: if offline or rate-limited, returns `null`
 * so the dossier falls back seamlessly to static project metadata.
 */

let cachedActivity: GitHubActivityPayload | null = null
let inflight: Promise<GitHubActivityPayload | null> | null = null

export function resetClientGitHubCache(): void {
  cachedActivity = null
  inflight = null
}

export async function fetchLiveGitHubActivity(
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
  endpoint = '/agent/v1/github',
): Promise<GitHubActivityPayload | null> {
  if (cachedActivity) return cachedActivity
  if (inflight) return inflight

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5_500)

  inflight = fetchImpl(endpoint, {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal: controller.signal,
  })
    .then(async (res) => {
      clearTimeout(timer)
      const contentType = res.headers.get('content-type') ?? ''
      if (!res.ok || !contentType.includes('application/json')) return null
      const data = (await res.json()) as Partial<GitHubActivityPayload>
      if (
        typeof data.username !== 'string' ||
        !Array.isArray(data.releases) ||
        !Array.isArray(data.recentRepos)
      ) {
        return null
      }
      cachedActivity = data as GitHubActivityPayload
      return cachedActivity
    })
    .catch(() => {
      clearTimeout(timer)
      return null
    })
    .finally(() => {
      inflight = null
    })

  return inflight
}
