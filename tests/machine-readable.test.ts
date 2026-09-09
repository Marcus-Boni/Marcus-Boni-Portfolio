import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { profile } from '@/data/profile'

/**
 * The files agents read before anything else: `llms.txt`, `llms-full.txt`,
 * `agent-instructions.md`, `robots.txt`, the fallback sitemap, and the header
 * rules that decide how they are served.
 *
 * The readiness gap these close is "no agent instruction file with when-to-use
 * guidance found". Generic marketing copy does not read as guidance, so the
 * assertions below are about *specificity*: named tasks, named endpoints, and
 * an explicit statement of what the site is not for.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative: string) => readFileSync(path.join(root, relative), 'utf8')

/** Collapses whitespace, so a sentence wrapped at 80 columns still matches. */
const flat = (text: string) => text.replace(/\s+/g, ' ')

describe('public/llms.txt', () => {
  const llms = read('public/llms.txt')

  it('follows the llmstxt.org shape: an H1, then a blockquote summary', () => {
    const lines = llms.split('\n')
    expect(lines[0].startsWith('# ')).toBe(true)
    expect(lines.slice(0, 4).some((line) => line.startsWith('> '))).toBe(true)
  })

  it('has a when-to-use section, in English', () => {
    // The readiness check reads this file and did not recognise the section
    // while its heading was Portuguese ("Quando usar este site"), even though
    // the English one existed in /agent-instructions.md. The file is read by
    // machines; the guidance headings are English now. Site *content* stays
    // bilingual, and llms-full.txt is still Portuguese.
    expect(llms).toContain('## When to use this site')
    expect(llms).toContain('## When not to use this site')
  })

  it('names concrete tasks rather than describing the site', () => {
    // "Be specific about the jobs you are right for — generic marketing copy
    // does not read as guidance."
    for (const job of [
      'Evaluating Marcus Boni for work',
      'Answering "has he done X before?"',
      'Sourcing or quoting his technical writing',
      'Locating his public code',
    ]) {
      expect(llms).toContain(job)
    }
  })

  it('says what the site is not for', () => {
    expect(llms).toContain('Not a technical reference')
    expect(llms).toContain('Not a service')
    expect(llms).toContain('Not a directory')
  })

  it('explains how to call the site', () => {
    expect(llms).toContain('Accept: text/markdown')
    expect(llms).toContain('Vary: Accept')
    expect(llms).toContain('`404`')
    expect(llms).toContain('RFC 9457')
  })

  it('lists the API surface, so the endpoints are discoverable by name', () => {
    // The "developer resource discoverability" check wants the API docs listed
    // in llms.txt, not only linked from a page.
    expect(llms).toContain('/openapi.json')
    for (const operation of ['/api/v1/profile', '/api/v1/projects', '/api/v1/posts']) {
      expect(llms).toContain(operation)
    }
  })

  it('links the dedicated agent-instructions file and the developer portal', () => {
    expect(llms).toContain('https://marcusboni.com.br/agent-instructions.md')
    expect(llms).toContain('https://marcusboni.com.br/developers')
  })

  it('states the repository count that profile.ts holds', () => {
    expect(llms).toContain(String(profile.repoCount))
  })
})

describe('public/agent-instructions.md', () => {
  const doc = read('public/agent-instructions.md')

  it('is structured around the decision an agent has to make', () => {
    expect(doc).toContain('## What this site is')
    expect(doc).toContain('## When to use this site')
    expect(doc).toContain('## When not to use this site')
    expect(doc).toContain('## How to call it')
  })

  it('gives a runnable request for each need', () => {
    expect(doc).toContain("curl -s -H 'Accept: text/markdown' https://marcusboni.com.br/")
    expect(doc).toContain('curl -s https://marcusboni.com.br/llms-full.txt')
    expect(doc).toContain('curl -s https://marcusboni.com.br/sitemap.xml')
  })

  it('states the HTTP contract, including the status codes', () => {
    expect(doc).toContain('acceptmarkdown.com')
    expect(doc).toContain('`Vary: Accept`')
    expect(doc).toContain('an unknown path returns `404`')
    expect(doc).toContain('`406`')
  })

  it('sets ground rules against invention and identity confusion', () => {
    expect(doc).toContain('Do not invent.')
    expect(doc).toContain('Do not merge identities.')
    expect(doc).toContain(profile.fullName)
  })

  it('limits contact to the published channels', () => {
    expect(doc).toContain(profile.email)
    expect(doc).toContain(profile.github)
    expect(flat(doc)).toContain('Do not infer a phone number')
  })
})

describe('public/llms-full.txt', () => {
  const full = read('public/llms-full.txt')

  it('says when to reach for it rather than the short version', () => {
    expect(full).toContain('## Quando usar este arquivo')
  })

  it('documents how to call the site and links the portal', () => {
    expect(full).toContain('## Como chamar este site')
    expect(full).toContain('https://marcusboni.com.br/developers')
    expect(full).toContain('https://marcusboni.com.br/agent-instructions.md')
  })

  it('agrees with profile.ts on the repository count', () => {
    expect(full).toContain(`(${profile.repoCount} repositórios públicos)`)
  })
})

describe('public/robots.txt', () => {
  const robots = read('public/robots.txt')

  it('still allows everything except the admin app', () => {
    expect(robots).toContain('User-agent: *')
    expect(robots).toContain('Allow: /')
    expect(robots).toContain('Disallow: /admin')
  })

  it('advertises the sitemap', () => {
    expect(robots).toContain('Sitemap: https://marcusboni.com.br/sitemap.xml')
  })
})

describe('sitemap', () => {
  it('includes the developer portal in the static fallback', () => {
    expect(read('public/sitemap.xml')).toContain(
      '<loc>https://marcusboni.com.br/developers</loc>',
    )
  })

  it('includes it in the live generator too', () => {
    // `feeds.ts` cannot be imported here (Deno globals at module load), so the
    // route table is asserted against its source.
    expect(read('netlify/edge-functions/feeds.ts')).toContain("path: '/developers'")
  })
})

describe('public/.well-known/api-catalog', () => {
  const catalog = JSON.parse(read('public/.well-known/api-catalog')) as {
    linkset: {
      anchor: string
      'service-desc': { href: string; type: string }[]
      'service-doc': { href: string; type: string }[]
    }[]
  }

  it('is an RFC 9727 linkset anchored on the API base', () => {
    expect(catalog.linkset).toHaveLength(1)
    expect(catalog.linkset[0].anchor).toBe('https://marcusboni.com.br/api/v1')
  })

  it('points service-desc at the OpenAPI document with its media type', () => {
    const [desc] = catalog.linkset[0]['service-desc']
    expect(desc.href).toBe('https://marcusboni.com.br/openapi.json')
    expect(desc.type).toBe('application/vnd.oai.openapi+json;version=3.1')
  })

  it('points service-doc at pages that exist', () => {
    const hrefs = catalog.linkset[0]['service-doc'].map((link) => link.href)
    expect(hrefs).toContain('https://marcusboni.com.br/developers')
    expect(hrefs).toContain('https://marcusboni.com.br/agent-instructions.md')
  })
})

describe('public/openapi.json', () => {
  it('is committed, so the endpoint exists without a generator at build time', () => {
    // `tests/api-payloads.test.ts` writes it; this asserts it was not deleted.
    const document = JSON.parse(read('public/openapi.json')) as { openapi: string }
    expect(document.openapi).toBe('3.1.0')
  })
})

describe('public/_headers', () => {
  const headers = read('public/_headers')

  it('serves agent-instructions.md as Markdown rather than leaving it to sniffing', () => {
    const block = headers.slice(headers.indexOf('/agent-instructions.md'))
    expect(block).toContain('Content-Type: text/markdown; charset=utf-8')
    expect(block).toContain('X-Content-Type-Options: nosniff')
  })

  it('does not try to set headers for the negotiated Markdown variants', () => {
    // Those come from the edge function, which sets its own Cache-Control and
    // Vary. A rule here would fight it.
    expect(headers).not.toMatch(/^\/llms\.txt\n\s+Content-Type/m)
    expect(headers).not.toContain('Vary: Accept')
  })
})
