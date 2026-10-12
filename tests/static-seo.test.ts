import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (name: string) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')

describe('public SEO documents', () => {
  it('matches the default Portuguese content and has valid entity identities', () => {
    const html = read('index.html')
    expect(html).toContain('<html lang="pt-BR"')
    const script = html.match(/<script id="site-jsonld" type="application\/ld\+json">([\s\S]*?)<\/script>/)
    const data = JSON.parse(script![1])
    expect(data['@graph'].map((entity: { '@type': string }) => entity['@type'])).toEqual(['Person', 'WebSite', 'WebPage'])
    expect(data['@graph'][0]['@id']).toBe('https://marcusboni.com.br/about#person')
    expect(data['@graph'][1].publisher['@id']).toBe(data['@graph'][0]['@id'])
    expect(html.match(/BODY:START/g)).toHaveLength(1)
    expect(html.match(/BODY:END/g)).toHaveLength(1)
  })

  it('identifies the visible author through their profile page', () => {
    const html = read('public/about.html')
    const script = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
    const data = JSON.parse(script![1])
    expect(data['@type']).toBe('ProfilePage')
    expect(data.mainEntity['@id']).toBe('https://marcusboni.com.br/about#person')
    expect(data.mainEntity.name).toBe('Marcus Boni')
    expect(data.mainEntity.sameAs).toContain('https://github.com/Marcus-Boni')
  })

  it.each(['about', 'contact', 'privacy', 'developers'])('redirects the duplicate /%s.html URL permanently', (page) => {
    const redirects = read('public/_redirects')
    expect(redirects).toMatch(new RegExp(`/${page}\\.html\\s+/${page}\\s+301!`))
  })

  it('excludes management pages from search via response headers', () => {
    const headers = read('public/_headers')
    expect(headers).toMatch(/\/admin\s+X-Robots-Tag: noindex, nofollow/)
    expect(headers).toMatch(/\/admin\/\*\s+X-Robots-Tag: noindex, nofollow/)
    expect(read('public/robots.txt')).toContain('Sitemap: https://marcusboni.com.br/sitemap.xml')
  })

  it.each(['index.html', 'public/about.html', 'public/contact.html', 'public/privacy.html', 'public/developers.html'])('%s has one canonical, description and heading', (name) => {
    const html = read(name)
    expect(html.match(/rel="canonical"/g)).toHaveLength(1)
    expect(html.match(/name="description"/g)).toHaveLength(1)
    expect(html.match(/<h1\b/g)).toHaveLength(1)
  })

  it.each(['index.html', 'public/about.html', 'public/contact.html', 'public/privacy.html', 'public/developers.html'])('%s shares a 1200x630 image as a large X card', (name) => {
    const html = read(name)
    expect(html).toContain('content="https://marcusboni.com.br/og-image.jpg"')
    expect(html).toMatch(/property="og:image:width" content="1200"/)
    expect(html).toMatch(/property="og:image:height" content="630"/)
    expect(html).toMatch(/name="twitter:card" content="summary_large_image"/)
    expect(html).not.toContain('property="twitter:')
  })

  it('serves the share image in the format its extension declares, at the declared size', () => {
    const bytes = readFileSync(new URL('../public/og-image.jpg', import.meta.url))
    expect([bytes[0], bytes[1]]).toEqual([0xff, 0xd8])
    // SOF0/SOF2 marker: height then width, big-endian.
    let offset = 2
    while (offset < bytes.length && !(bytes[offset] === 0xff && (bytes[offset + 1] === 0xc0 || bytes[offset + 1] === 0xc2))) {
      offset += 2 + bytes.readUInt16BE(offset + 2)
    }
    expect([bytes.readUInt16BE(offset + 7), bytes.readUInt16BE(offset + 5)]).toEqual([1200, 630])
    expect(read('public/_redirects')).toMatch(/\/og-image\.png\s+\/og-image\.jpg\s+301!/)
  })
})
