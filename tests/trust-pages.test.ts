import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { experience, profile } from '@/data/profile'

import {
  aboutMarkdown,
  contactMarkdown,
  privacyMarkdown,
} from '../netlify/lib/agent-docs.ts'
import { ROUTES } from '../netlify/lib/routes.ts'

/**
 * The trust pages: `/about`, `/contact`, `/privacy`.
 *
 * "These are the pages AI agents check to verify your business is legitimate
 * before recommending you" — which is also why the threshold is *content*, not
 * existence. A stub with a heading and a mailto passes a link check and fails
 * the actual job, so these tests measure the delivered text.
 *
 * The privacy page has a second reason to be verified: it makes factual claims
 * about what the site collects, and those claims have to match
 * `src/lib/analytics.ts` and `src/lib/messages.ts`.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative: string) => readFileSync(path.join(root, relative), 'utf8')

function visibleText(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

const pages = [
  ['about', 'Sobre — Marcus Boni', aboutMarkdown()],
  ['contact', 'Contato — Marcus Boni', contactMarkdown()],
  ['privacy', 'Privacidade — Marcus Boni', privacyMarkdown()],
] as const

describe.each(pages)('/%s', (name, title, markdown) => {
  const html = read(`public/${name}.html`)
  const text = visibleText(html)

  it('carries well over the 500 characters the check asks for', () => {
    expect(text.length).toBeGreaterThan(500)
  })

  it('has its own title and canonical, not the SPA shell', () => {
    expect(html).toContain(`<title>${title}</title>`)
    expect(html).toContain(
      `<link rel="canonical" href="https://marcusboni.com.br/${name}" />`,
    )
  })

  it('declares its Markdown representation', () => {
    expect(html).toContain(
      `<link rel="alternate" type="text/markdown" href="https://marcusboni.com.br/${name}" />`,
    )
  })

  it('is a document, not an app — no bundle to wait on', () => {
    expect(html).not.toMatch(/<script/i)
  })

  it('uses the shared stylesheet rather than its own copy', () => {
    expect(html).toContain('<link rel="stylesheet" href="/page.css" />')
    expect(html).not.toMatch(/<style>/)
  })

  it('has one h1 and sequential headings', () => {
    expect(html.match(/<h1\b/gi) ?? []).toHaveLength(1)
    const levels = [...html.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]))
    expect(levels[0]).toBe(1)
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1)
    }
  })

  it('publishes the contact address', () => {
    expect(text).toContain(profile.email)
  })

  it('has a Markdown twin of comparable substance', () => {
    expect(markdown.length).toBeGreaterThan(500)
    expect(markdown).toContain(profile.email)
  })
})

describe('/about content', () => {
  const text = visibleText(read('public/about.html'))

  it('names the employer and the sectors delivered in', () => {
    expect(text).toContain(experience.company)
    for (const sector of ['Saúde', 'Indústria', 'Logística', 'Imobiliário']) {
      expect(text).toContain(sector)
    }
  })

  it('names the clients, which is what makes it verifiable', () => {
    for (const client of ['Unimed Sul Capixaba', 'Hidrauvit', 'Cedisa', 'Galwan']) {
      expect(text).toContain(client)
    }
  })

  it('agrees with profile.ts on the repository count', () => {
    expect(text).toContain(String(profile.repoCount))
  })
})

describe('/contact content', () => {
  const text = visibleText(read('public/contact.html'))

  it('answers the three things the evaluator said were missing', () => {
    // "the site lacks pricing, contact information, case studies, and service
    // details" — contact, service details, and how pricing works.
    expect(text).toContain(profile.email)
    expect(text).toContain('Que trabalho eu pego')
    expect(text).toContain('orçamento')
  })

  it('is honest that there is no rate card rather than inventing one', () => {
    expect(text).toContain('Não publico tabela de preço')
  })

  it('states timezone and working languages', () => {
    expect(text).toContain('UTC−3')
    expect(text).toContain('português')
    expect(text).toContain('inglês')
  })
})

describe('/privacy content matches the code', () => {
  const html = read('public/privacy.html')
  const text = visibleText(html)
  const analytics = read('src/lib/analytics.ts')
  const messages = read('src/lib/messages.ts')

  it('names the controller and a channel for data requests', () => {
    expect(text).toContain(profile.fullName)
    expect(text).toContain(profile.email)
    expect(text).toContain('LGPD')
  })

  it('claims no cookies, and the tracker really uses none', () => {
    expect(text).toContain('não usa cookies')
    // The claim is only true while the tracker stays on web storage.
    expect(analytics).not.toContain('document.cookie')
    expect(analytics).toContain('localStorage')
    expect(analytics).toContain('sessionStorage')
  })

  it('claims no IP geolocation, and the country really comes from the timezone', () => {
    expect(text).toContain('não faz geolocalização por IP')
    expect(analytics).toContain('countryFromTimezone')
  })

  it('lists the storage keys the tracker actually writes', () => {
    for (const key of ['mb-locale']) expect(text).toContain(key)
  })

  it('describes the contact-form fields the code actually stores', () => {
    // MessageDraft: name, email, message, locale, referrerHost, country.
    for (const field of ['name', 'email', 'message', 'locale']) {
      expect(messages).toContain(field)
    }
    expect(text).toContain('nome')
    expect(text).toContain('mensagem')
  })

  it('names both processors', () => {
    expect(text).toContain('Firebase')
    expect(text).toContain('Netlify')
  })

  it('states a retention period for each of the two collections', () => {
    expect(text).toContain('12 meses')
    expect(text).toContain('enquanto a conversa for relevante')
  })
})

describe('routing', () => {
  const redirects = read('public/_redirects')
    .split('\n')
    .map((line) => line.trim().split(/\s+/))

  it.each(['about', 'contact', 'privacy'])('rewrites /%s to its flat file', (name) => {
    const rule = redirects.find(([from]) => from === `/${name}`)
    expect(rule?.[1]).toBe(`/${name}.html`)
    expect(rule?.[2]).toBe('200')
  })

  it.each(['about', 'contact', 'privacy'])(
    '/%s is in the route table, so Markdown negotiation reaches it',
    (name) => {
      const route = ROUTES.find((entry) => entry.path === `/${name}`)
      expect(route).toBeDefined()
      expect(route?.served).toBe('static')
    },
  )

  it.each(['about', 'contact', 'privacy'])('/%s is in the sitemap', (name) => {
    expect(read('public/sitemap.xml')).toContain(
      `<loc>https://marcusboni.com.br/${name}</loc>`,
    )
    expect(read('netlify/edge-functions/feeds.ts')).toContain(`path: '/${name}'`)
  })

  it('ships the shared stylesheet the pages link', () => {
    expect(existsSync(path.join(root, 'public/page.css'))).toBe(true)
  })

  it('lets the top nav wrap, or four links overflow a phone', () => {
    // /developers has two nav links and fit; the trust pages have four and
    // pushed the page 29px wider than a 380px viewport until this was added.
    const css = read('public/page.css')
    const topbar = css.slice(css.indexOf('.topbar {'), css.indexOf('.wordmark'))
    expect(topbar).toContain('flex-wrap: wrap')
  })

  it('links them from the raw HTML of the home page', () => {
    const hrefs = [...read('index.html').matchAll(/href="([^"]+)"/g)].map((m) => m[1])
    for (const href of ['/about', '/contact', '/privacy']) {
      expect(hrefs).toContain(href)
    }
  })
})
