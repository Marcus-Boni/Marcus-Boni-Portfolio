import { describe, expect, it } from 'vitest'

import {
  CHANNEL_LABEL,
  isBotUserAgent,
  isLocalOrPreviewHost,
  parseUtmParams,
  resolveAttribution,
} from '@/lib/analytics-attribution'
import { summarize, type AnalyticsEvent } from '@/admin/services/analytics'

function makeEvent(overrides: Partial<AnalyticsEvent> = {}): AnalyticsEvent {
  return {
    id: Math.random().toString(36).slice(2),
    type: 'pageview',
    path: '/',
    visitorId: 'visitor-ext-1',
    sessionId: 'session-ext-1',
    isNewVisitor: true,
    device: 'desktop',
    browser: 'Chrome',
    os: 'Windows',
    referrerHost: 'Direct',
    source: 'Direto',
    channel: 'direct',
    landingPath: '/',
    country: 'Brazil',
    language: 'pt-BR',
    createdAt: new Date('2026-11-27T15:00:00.000Z'),
    ...overrides,
  }
}

describe('analytics attribution & noise guards', () => {
  it('classifies search engines, social apps, AI assistants, developer communities, and external sites', () => {
    expect(resolveAttribution({ referrer: 'https://www.google.com.br/search?q=marcus+boni' })).toMatchObject({
      source: 'Google',
      channel: 'organic',
    })
    expect(resolveAttribution({ referrer: 'android-app://com.linkedin.android/' })).toMatchObject({
      source: 'LinkedIn',
      channel: 'social',
    })
    expect(resolveAttribution({ referrerHost: 'lnkd.in' })).toMatchObject({
      source: 'LinkedIn',
      channel: 'social',
    })
    expect(resolveAttribution({ referrerHost: 'l.instagram.com' })).toMatchObject({
      source: 'Instagram',
      channel: 'social',
    })
    expect(resolveAttribution({ referrerHost: 't.co' })).toMatchObject({
      source: 'X / Twitter',
      channel: 'social',
    })
    expect(resolveAttribution({ referrer: 'https://chatgpt.com/' })).toMatchObject({
      source: 'ChatGPT',
      channel: 'ai',
    })
    expect(resolveAttribution({ referrer: 'https://www.perplexity.ai/search/123' })).toMatchObject({
      source: 'Perplexity',
      channel: 'ai',
    })
    expect(resolveAttribution({ referrer: 'https://github.com/Marcus-Boni/ISPer' })).toMatchObject({
      source: 'GitHub',
      channel: 'community',
    })
    expect(resolveAttribution({ referrer: 'https://www.tabnews.com.br/post' })).toMatchObject({
      source: 'TabNews',
      channel: 'community',
    })
    expect(resolveAttribution({ referrer: 'https://optsolv.com.br/time' })).toMatchObject({
      source: 'optsolv.com.br',
      channel: 'referral',
    })
  })

  it('never classifies self-referrals, Internal, or localhost as external sources', () => {
    for (const referrerHost of ['Internal', 'marcusboni.com.br', 'www.marcusboni.com.br', 'localhost:5173', 'Direct', '']) {
      expect(resolveAttribution({ referrerHost })).toMatchObject({
        source: 'Direto',
        channel: 'direct',
      })
    }
  })

  it('prioritizes explicit UTM and ?ref= parameters when apps strip document.referrer', () => {
    expect(parseUtmParams('?utm_source=cv&utm_medium=pdf&utm_campaign=2026')).toMatchObject({
      utmSource: 'cv',
      utmMedium: 'pdf',
      utmCampaign: '2026',
    })
    expect(
      resolveAttribution({
        referrer: '',
        search: '?utm_source=whatsapp&utm_medium=dm&utm_campaign=vaga',
      }),
    ).toMatchObject({
      source: 'WhatsApp',
      channel: 'social',
      utmSource: 'whatsapp',
      utmMedium: 'dm',
      utmCampaign: 'vaga',
    })
    expect(
      resolveAttribution({
        referrer: '',
        search: '?ref=cv',
      }),
    ).toMatchObject({
      source: 'Currículo PDF',
      channel: 'campaign',
      utmSource: 'cv',
    })
  })

  it('detects localhost, private LANs, and Netlify/Firebase preview hosts vs production domain', () => {
    expect(isLocalOrPreviewHost('localhost')).toBe(true)
    expect(isLocalOrPreviewHost('127.0.0.1')).toBe(true)
    expect(isLocalOrPreviewHost('192.168.1.42')).toBe(true)
    expect(isLocalOrPreviewHost('deploy-preview-12--marcus-boni.netlify.app')).toBe(true)
    expect(isLocalOrPreviewHost('marcusboni.com.br')).toBe(false)
    expect(isLocalOrPreviewHost('www.marcusboni.com.br')).toBe(false)
  })

  it('filters crawlers, scrapers, and webdriver sessions while allowing real browsers', () => {
    expect(isBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true)
    expect(isBotUserAgent('Mozilla/5.0 HeadlessChrome/130.0.0.0')).toBe(true)
    expect(isBotUserAgent('LinkedInBot/1.0')).toBe(true)
    expect(isBotUserAgent('Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36', true)).toBe(true)
    expect(
      isBotUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      ),
    ).toBe(false)
  })
})

describe('analytics summary — owner filtering & session-level attribution', () => {
  const now = new Date('2026-11-27T18:00:00.000Z')

  it('excludes owner devices, /admin routes, and localhost noise when excludeOwner is enabled', () => {
    const events: AnalyticsEvent[] = [
      // Owner's repeated visits
      makeEvent({ visitorId: 'owner-laptop', sessionId: 'owner-s1', path: '/', createdAt: new Date('2026-11-27T14:00:00.000Z') }),
      makeEvent({ visitorId: 'owner-laptop', sessionId: 'owner-s1', path: '/blog', createdAt: new Date('2026-11-27T14:01:00.000Z') }),
      // Accidental /admin event
      makeEvent({ visitorId: 'other', sessionId: 'admin-s', path: '/admin/blog', createdAt: new Date('2026-11-27T14:05:00.000Z') }),
      // Dev preview referrer
      makeEvent({ visitorId: 'dev', sessionId: 'dev-s', referrerHost: 'localhost:5173', createdAt: new Date('2026-11-27T14:10:00.000Z') }),
      // Genuine external LinkedIn visitor reading 3 pages
      makeEvent({
        visitorId: 'recruiter-1',
        sessionId: 'rec-s1',
        path: '/',
        landingPath: '/',
        source: 'LinkedIn',
        channel: 'social',
        referrerHost: 'lnkd.in',
        createdAt: new Date('2026-11-27T15:00:00.000Z'),
      }),
      makeEvent({
        visitorId: 'recruiter-1',
        sessionId: 'rec-s1',
        path: '/blog/wifi-ia',
        source: 'Direto',
        channel: 'direct',
        referrerHost: 'Internal',
        createdAt: new Date('2026-11-27T15:01:00.000Z'),
      }),
      makeEvent({
        type: 'post_view',
        visitorId: 'recruiter-1',
        sessionId: 'rec-s1',
        path: '/blog/wifi-ia',
        slug: 'wifi-ia',
        lang: 'pt',
        createdAt: new Date('2026-11-27T15:01:02.000Z'),
      }),
      makeEvent({
        type: 'post_read',
        visitorId: 'recruiter-1',
        sessionId: 'rec-s1',
        path: '/blog/wifi-ia',
        slug: 'wifi-ia',
        createdAt: new Date('2026-11-27T15:03:00.000Z'),
      }),
      makeEvent({
        type: 'cv_download',
        visitorId: 'recruiter-1',
        sessionId: 'rec-s1',
        path: '/',
        createdAt: new Date('2026-11-27T15:04:00.000Z'),
      }),
    ]

    const clean = summarize(events, '7d', {
      now,
      excludeOwner: true,
      excludedVisitorIds: new Set(['owner-laptop']),
    })

    expect(clean.filteredEvents).toBe(4)
    expect(clean.filteredSessions).toBe(3)
    expect(clean.visitors.current).toBe(1)
    expect(clean.sessions.current).toBe(1)
    expect(clean.pageviews.current).toBe(2)
    expect(clean.engagementRate.current).toBe(100)
    expect(clean.bounceRate.current).toBe(0)
    // Attributed ONCE per session to LinkedIn / Redes sociais — zero Internal pollution!
    expect(clean.byChannel).toEqual([{ name: CHANNEL_LABEL.social, count: 1, previous: 0 }])
    expect(clean.bySource).toEqual([{ name: 'LinkedIn', count: 1, previous: 0 }])
    expect(clean.byLandingPath).toEqual([{ name: '/', count: 1, previous: 0 }])
    // Journey summary captures full path & actions
    expect(clean.recentSessions).toHaveLength(1)
    expect(clean.recentSessions[0]).toMatchObject({
      source: 'LinkedIn',
      channel: 'social',
      landingPath: '/',
      pages: ['/', '/blog/wifi-ia'],
      durationSeconds: 240,
      engaged: true,
    })
    expect(clean.recentSessions[0].actions).toEqual(expect.arrayContaining(['Leu artigo', 'Baixou CV']))
    // Blog performance splits PT vs EN
    expect(clean.posts[0]).toMatchObject({
      slug: 'wifi-ia',
      views: 1,
      viewsPt: 1,
      viewsEn: 0,
      reads: 1,
      readRate: 100,
    })

    // Disabling excludeOwner exposes everything for inspection
    const unfiltered = summarize(events, '7d', {
      now,
      excludeOwner: false,
      excludedVisitorIds: new Set(['owner-laptop']),
    })
    expect(unfiltered.filteredEvents).toBe(0)
    expect(unfiltered.sessions.current).toBe(4)
    expect(unfiltered.recentSessions.some((s) => s.visitorId === 'owner-laptop' && s.isOwner)).toBe(true)
  })
})
