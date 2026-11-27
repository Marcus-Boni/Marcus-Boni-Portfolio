import { useEffect } from 'react'

import type { Locale } from '@/i18n/translations'

/**
 * Self-contained `<head>` manager for `/ask` and `/en/ask`.
 *
 * Kept independent of `src/blog/lib/seo.ts` and `netlify/lib/blog-seo.ts` on
 * purpose: sharing those modules across three entry/lazy boundaries (`App`,
 * `BlogApp`, `AgentPage`) triggers Rolldown to hoist `blog-locale`, `blog-seo`,
 * and `profile` into extra static `<link rel="modulepreload">` chunks on `/`.
 */

const SITE_URL = 'https://marcusboni.com.br'
const SITE_NAME = 'Marcus Boni'
const DEFAULT_OG = `${SITE_URL}/og-image.jpg`

function removeHead(selector: string) {
  document.head.querySelectorAll(selector).forEach((node) => node.remove())
}

function setMeta(attr: 'name' | 'property' | 'http-equiv', key: string, content: string) {
  removeHead(`meta[${attr}="${key}"]`)
  const tag = document.createElement('meta')
  tag.setAttribute(attr, key)
  tag.setAttribute('content', content)
  document.head.appendChild(tag)
}

function setLink(rel: string, href: string, attributes: Record<string, string> = {}) {
  const tag = document.createElement('link')
  tag.setAttribute('rel', rel)
  tag.setAttribute('href', href)
  for (const [key, value] of Object.entries(attributes)) tag.setAttribute(key, value)
  document.head.appendChild(tag)
}

function setJsonLd(data: object) {
  document.head.querySelectorAll('script[type="application/ld+json"]').forEach((node) => {
    if (
      node.id === 'blog-jsonld' ||
      node.id === 'site-jsonld' ||
      /"@type"\s*:\s*"(?:BlogPosting|Blog|BreadcrumbList|WebPage)"/.test(node.textContent ?? '')
    ) {
      node.remove()
    }
  })
  const script = document.createElement('script')
  script.id = 'blog-jsonld'
  script.setAttribute('type', 'application/ld+json')
  script.textContent = JSON.stringify(data)
  document.head.appendChild(script)
}

/** Keeps `/ask` and `/en/ask` head metadata in lockstep with `blog-meta.ts`. */
export function applyAskHead(locale: Locale = 'pt') {
  const isPt = locale === 'pt'
  const title = isPt
    ? `Dossiê interativo — ${SITE_NAME}`
    : `Interactive dossier — ${SITE_NAME}`
  const description = isPt
    ? 'Consulte a trajetória, projetos, stack e entregas em produção de Marcus Boni ou cole uma vaga (/fit) para mapear evidências reais.'
    : 'Query Marcus Boni’s stack, repositories, and production client work, or paste a job description (/fit) for an evidence-based role brief.'
  const imageAlt = isPt
    ? 'Marcus Boni — engenharia de software, sistemas e IA aplicada'
    : 'Marcus Boni — software engineering, systems and applied AI'
  const ptUrl = `${SITE_URL}/ask`
  const enUrl = `${SITE_URL}/en/ask`
  const url = isPt ? ptUrl : enUrl
  const contentLang = isPt ? 'pt-BR' : 'en'

  document.title = title
  document.documentElement.lang = contentLang
  removeHead('meta[property^="article:"]')
  removeHead('meta[property="og:locale:alternate"]')
  removeHead('link[rel="canonical"]')
  removeHead('link[rel="alternate"][hreflang]')
  removeHead('link[rel="alternate"][type="text/markdown"]')
  removeHead('link[rel="alternate"][href="/en/rss.xml"]')
  removeHead('meta[name^="twitter:"]')
  removeHead('meta[property^="twitter:"]')

  setMeta('name', 'title', title)
  setMeta('name', 'description', description)
  setMeta('http-equiv', 'content-language', contentLang)
  setMeta('name', 'robots', 'index, follow, max-image-preview:large')
  setLink('canonical', url)
  setLink('alternate', url, { type: 'text/markdown' })
  setLink('alternate', ptUrl, { hreflang: 'pt-BR' })
  setLink('alternate', enUrl, { hreflang: 'en' })
  setLink('alternate', ptUrl, { hreflang: 'x-default' })

  for (const [key, value] of Object.entries({
    type: 'website',
    url,
    title,
    description,
    image: DEFAULT_OG,
    'image:type': 'image/jpeg',
    'image:width': '1200',
    'image:height': '630',
    'image:alt': imageAlt,
    site_name: SITE_NAME,
    locale: isPt ? 'pt_BR' : 'en_US',
    'locale:alternate': isPt ? 'en_US' : 'pt_BR',
  })) {
    setMeta('property', `og:${key}`, value)
  }

  for (const [key, value] of Object.entries({
    card: 'summary_large_image',
    url,
    title,
    description,
    image: DEFAULT_OG,
    'image:alt': imageAlt,
  })) {
    setMeta('name', `twitter:${key}`, value)
  }

  setJsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: title,
        description,
        inLanguage: contentLang,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        about: { '@id': `${SITE_URL}/about#person` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE_NAME, item: SITE_URL },
          {
            '@type': 'ListItem',
            position: 2,
            name: isPt ? 'Dossiê interativo' : 'Interactive dossier',
            item: url,
          },
        ],
      },
    ],
  })
}

export function useAskHead(locale: Locale) {
  useEffect(() => applyAskHead(locale), [locale])
}
