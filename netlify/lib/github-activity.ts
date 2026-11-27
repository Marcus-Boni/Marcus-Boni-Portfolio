/**
 * Phase 4 live GitHub activity aggregator (`/agent/v1/github`).
 *
 * Pure Web Standard `fetch` + in-memory Edge cache (20 min TTL) so recruiters
 * and CTOs asking about recent engineering activity see live releases and
 * recently pushed repositories without exhausting GitHub's anonymous rate limit.
 *
 * Optional server-side `GITHUB_TOKEN` (never exposed to the client) lifts the
 * GitHub API quota from 60 req/hr to 5,000 req/hr. On upstream error or rate
 * limit, falls back to stale cache if available or returns a clean 503 JSON.
 */

const DEFAULT_USERNAME = 'Marcus-Boni'
const FEATURED_REPOS = [
  'ISPer',
  'OptTime',
  'chatbot-template',
  'Auto-Daily-App',
  'Ferramenta-Estimativa-Horas',
] as const

const CACHE_TTL_MS = 20 * 60 * 1000
const UPSTREAM_TIMEOUT_MS = 6_000
const JSON_TYPE = 'application/json; charset=utf-8'

export interface GitHubReleaseItem {
  repo: string
  tag: string
  name: string
  publishedAt: string
  url: string
  summary: string
}

export interface GitHubRepoActivity {
  name: string
  description: string
  language: string | null
  stars: number
  pushedAt: string
  url: string
  topics: string[]
}

export interface GitHubActivityPayload {
  username: string
  fetchedAt: string
  cached: boolean
  releases: GitHubReleaseItem[]
  recentRepos: GitHubRepoActivity[]
}

export interface GitHubHandlerOptions {
  env?: (key: string) => string | undefined
  fetchImpl?: typeof fetch
  now?: () => number
  cache?: { payload: GitHubActivityPayload; expiresAt: number } | null
}

let defaultCache: { payload: GitHubActivityPayload; expiresAt: number } | null = null

export function resetGitHubActivityCache(): void {
  defaultCache = null
}

const defaultEnv = (key: string): string | undefined => {
  try {
    const deno = (
      globalThis as {
        Deno?: { env?: { get(name: string): string | undefined } }
      }
    ).Deno
    return deno?.env?.get(key)
  } catch {
    return undefined
  }
}

function summarizeReleaseBody(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const firstMeaningful = raw
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/^#+\s*/, '').replace(/^[-*•]\s*/, '').trim())
    .filter((line) => line.length >= 12 && !line.startsWith('**Full Changelog**'))
    .slice(0, 2)
    .join(' · ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
  if (firstMeaningful.length <= 180) return firstMeaningful
  return `${firstMeaningful.slice(0, 177).trimEnd()}…`
}

async function fetchJsonWithTimeout(
  url: string,
  headers: Record<string, string>,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

export async function handleGitHubActivity(
  request: Request,
  options: GitHubHandlerOptions = {},
): Promise<Response> {
  const method = request.method.toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') {
    return new Response(
      JSON.stringify({
        type: 'https://marcusboni.com.br/problems/method-not-allowed',
        title: 'Method Not Allowed',
        status: 405,
        detail: 'Use GET /agent/v1/github to inspect live repository and release activity.',
      }),
      {
        status: 405,
        headers: {
          'content-type': 'application/problem+json; charset=utf-8',
          allow: 'GET, HEAD',
        },
      },
    )
  }

  const now = options.now ?? (() => Date.now())
  const env = options.env ?? defaultEnv
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
  const useCustomCache = 'cache' in options
  const currentCache = useCustomCache ? options.cache : defaultCache

  if (currentCache && currentCache.expiresAt > now()) {
    const body = JSON.stringify({ ...currentCache.payload, cached: true })
    return new Response(method === 'HEAD' ? null : body, {
      status: 200,
      headers: {
        'content-type': JSON_TYPE,
        'cache-control': 'public, max-age=900, stale-while-revalidate=3600',
      },
    })
  }

  const username = (env('GITHUB_USERNAME') || DEFAULT_USERNAME).trim()
  const token = env('GITHUB_TOKEN')?.trim()
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'user-agent': 'marcusboni-dossier-edge/1.0',
    'x-github-api-version': '2022-11-28',
  }
  if (token) headers.authorization = `Bearer ${token}`

  try {
    const [reposRes, ...releaseResults] = await Promise.all([
      fetchJsonWithTimeout(
        `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=pushed&per_page=8&type=owner`,
        headers,
        fetchImpl,
        UPSTREAM_TIMEOUT_MS,
      ),
      ...FEATURED_REPOS.map((repo) =>
        fetchJsonWithTimeout(
          `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo)}/releases/latest`,
          headers,
          fetchImpl,
          UPSTREAM_TIMEOUT_MS,
        )
          .then(async (res) => (res.ok ? { repo, data: (await res.json()) as Record<string, unknown> } : null))
          .catch(() => null),
      ),
    ])

    const recentRepos: GitHubRepoActivity[] = []
    if (reposRes.ok) {
      const rawRepos = (await reposRes.json()) as Record<string, unknown>[]
      if (Array.isArray(rawRepos)) {
        for (const repo of rawRepos) {
          if (repo.fork === true || repo.private === true) continue
          const name = typeof repo.name === 'string' ? repo.name : ''
          const url = typeof repo.html_url === 'string' ? repo.html_url : ''
          const pushedAt = typeof repo.pushed_at === 'string' ? repo.pushed_at : ''
          if (!name || !url) continue
          recentRepos.push({
            name,
            description: typeof repo.description === 'string' ? repo.description : '',
            language: typeof repo.language === 'string' ? repo.language : null,
            stars: typeof repo.stargazers_count === 'number' ? repo.stargazers_count : 0,
            pushedAt,
            url,
            topics: Array.isArray(repo.topics)
              ? repo.topics.filter((t): t is string => typeof t === 'string').slice(0, 5)
              : [],
          })
          if (recentRepos.length >= 6) break
        }
      }
    }

    const releases: GitHubReleaseItem[] = []
    for (const entry of releaseResults) {
      if (!entry || !entry.data) continue
      const data = entry.data
      if (data.draft === true) continue
      const tag = typeof data.tag_name === 'string' ? data.tag_name : ''
      const url = typeof data.html_url === 'string' ? data.html_url : ''
      const publishedAt =
        typeof data.published_at === 'string'
          ? data.published_at
          : typeof data.created_at === 'string'
            ? data.created_at
            : ''
      if (!tag || !url) continue
      releases.push({
        repo: entry.repo,
        tag,
        name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : `${entry.repo} ${tag}`,
        publishedAt,
        url,
        summary: summarizeReleaseBody(data.body),
      })
    }

    releases.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))

    if (recentRepos.length === 0 && releases.length === 0) {
      if (currentCache) {
        const stale = JSON.stringify({ ...currentCache.payload, cached: true })
        return new Response(method === 'HEAD' ? null : stale, {
          status: 200,
          headers: { 'content-type': JSON_TYPE },
        })
      }
      return new Response(
        JSON.stringify({
          type: 'https://marcusboni.com.br/problems/upstream-unavailable',
          title: 'GitHub Activity Unavailable',
          status: 503,
          detail: 'Could not retrieve public GitHub activity right now.',
        }),
        {
          status: 503,
          headers: { 'content-type': 'application/problem+json; charset=utf-8' },
        },
      )
    }

    const payload: GitHubActivityPayload = {
      username,
      fetchedAt: new Date(now()).toISOString(),
      cached: false,
      releases,
      recentRepos,
    }

    if (!useCustomCache) {
      defaultCache = { payload, expiresAt: now() + CACHE_TTL_MS }
    }

    return new Response(method === 'HEAD' ? null : JSON.stringify(payload), {
      status: 200,
      headers: {
        'content-type': JSON_TYPE,
        'cache-control': 'public, max-age=900, stale-while-revalidate=3600',
      },
    })
  } catch {
    if (currentCache) {
      const stale = JSON.stringify({ ...currentCache.payload, cached: true })
      return new Response(method === 'HEAD' ? null : stale, {
        status: 200,
        headers: { 'content-type': JSON_TYPE },
      })
    }
    return new Response(
      JSON.stringify({
        type: 'https://marcusboni.com.br/problems/upstream-unavailable',
        title: 'GitHub Activity Unavailable',
        status: 503,
        detail: 'GitHub upstream request timed out or failed.',
      }),
      {
        status: 503,
        headers: { 'content-type': 'application/problem+json; charset=utf-8' },
      },
    )
  }
}
