/**
 * Pure traffic attribution, source normalization, and noise-detection helpers.
 *
 * Shared between the browser tracker (`src/lib/analytics.ts`) and the admin
 * aggregation engine (`src/admin/services/analytics.ts`) so historical events
 * (which only carry raw `referrerHost` like `l.instagram.com`, `lnkd.in`, or
 * `Internal`) and new events (which also carry normalized `source`, `channel`,
 * and `utm_*`) are classified identically.
 *
 * Zero DOM globals, zero Firebase imports, 100% unit-testable.
 */

export type TrafficChannel =
  | 'organic'
  | 'social'
  | 'ai'
  | 'community'
  | 'campaign'
  | 'referral'
  | 'direct'

export const CHANNEL_LABEL: Record<TrafficChannel, string> = {
  organic: 'Busca orgânica',
  social: 'Redes sociais',
  ai: 'IA & Assistentes',
  community: 'Comunidade & Código',
  campaign: 'Campanha / Link marcado',
  referral: 'Referência externa',
  direct: 'Acesso direto',
}

export interface UtmParams {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
  ref?: string
}

export interface Attribution {
  channel: TrafficChannel
  source: string
  referrerHost: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  landingPath?: string
}

const OWN_HOSTS = new Set([
  'marcusboni.com.br',
  'www.marcusboni.com.br',
])

/**
 * Local development, loopback, private LAN, and Netlify/Firebase preview hosts
 * should never pollute production portfolio analytics.
 */
export function isLocalOrPreviewHost(hostname: string): boolean {
  let host = hostname.trim().toLowerCase()
  if (host.startsWith('[')) {
    host = host.replace(/^\[([^\]]+)\](?::\d+)?$/, '$1')
  } else {
    host = host.replace(/:\d+$/, '')
  }
  if (!host) return true
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.localhost') ||
    host.endsWith('.netlify.app') ||
    host.endsWith('.web.app') ||
    host.endsWith('.firebaseapp.com')
  ) {
    return true
  }
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
    return true
  }
  return false
}

const BOT_UA_PATTERN =
  /bot\b|crawler|spider|slurp|mediapartners|lighthouse|pagespeed|headlesschrome|phantomjs|selenium|playwright|puppeteer|cypress|wget|curl\/|python-requests|python-urllib|axios\/|go-http-client|java\/|node-fetch|undici|facebookexternalhit|facebot|linkedinbot|twitterbot|whatsapp|telegrambot|slackbot|discordbot|applebot|bingpreview|google-inspectiontool|googleother|google-extended|gptbot|oai-searchbot|chatgpt-user|claudebot|claude-web|perplexitybot|bytespider|ahrefsbot|semrushbot|mj12bot|dotbot|petalbot|yandexbot|duckduckbot|baiduspider|pingdom|uptimerobot|statuscake|datadog|newrelic|gtmetrix|screaming frog/i

/** Detects crawlers, link-preview scrapers, synthetic monitors, and headless browsers. */
export function isBotUserAgent(userAgent: string, webdriver = false): boolean {
  if (webdriver) return true
  const ua = userAgent.trim()
  if (!ua) return true
  return BOT_UA_PATTERN.test(ua)
}

/** Extracts UTM parameters and `?ref=` from a URL query string. */
export function parseUtmParams(search: string): UtmParams {
  if (!search) return {}
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
  const clean = (key: string): string | undefined => {
    const raw = params.get(key)?.trim()
    return raw ? raw.slice(0, 80) : undefined
  }
  return {
    utmSource: clean('utm_source'),
    utmMedium: clean('utm_medium'),
    utmCampaign: clean('utm_campaign'),
    utmContent: clean('utm_content'),
    utmTerm: clean('utm_term'),
    ref: clean('ref'),
  }
}

interface KnownOrigin {
  source: string
  channel: TrafficChannel
  /** Exact normalized host or suffix (e.g. `google.` matches `google.com.br`). */
  hosts: string[]
  /** Known `utm_source` / `ref` aliases (lowercase). */
  aliases?: string[]
  /** Android `android-app://` package prefixes. */
  androidApps?: string[]
}

const KNOWN_ORIGINS: readonly KnownOrigin[] = [
  // Organic search
  {
    source: 'Google',
    channel: 'organic',
    hosts: ['google.com', 'google.com.br', 'google.pt', 'google.co.uk', 'google.es', 'google.fr', 'google.de', 'ampproject.org'],
    aliases: ['google', 'google-search', 'gsearch'],
    androidApps: ['com.google.android.googlequicksearchbox'],
  },
  {
    source: 'Bing',
    channel: 'organic',
    hosts: ['bing.com'],
    aliases: ['bing'],
  },
  {
    source: 'DuckDuckGo',
    channel: 'organic',
    hosts: ['duckduckgo.com'],
    aliases: ['duckduckgo', 'ddg'],
  },
  {
    source: 'Yahoo',
    channel: 'organic',
    hosts: ['search.yahoo.com', 'br.search.yahoo.com'],
    aliases: ['yahoo'],
  },
  {
    source: 'Brave Search',
    channel: 'organic',
    hosts: ['search.brave.com'],
    aliases: ['brave'],
  },
  {
    source: 'Ecosia',
    channel: 'organic',
    hosts: ['ecosia.org'],
    aliases: ['ecosia'],
  },
  {
    source: 'Yandex',
    channel: 'organic',
    hosts: ['yandex.com', 'yandex.ru'],
    aliases: ['yandex'],
  },
  {
    source: 'Kagi',
    channel: 'organic',
    hosts: ['kagi.com'],
    aliases: ['kagi'],
  },

  // AI & Assistants
  {
    source: 'ChatGPT',
    channel: 'ai',
    hosts: ['chatgpt.com', 'chat.openai.com', 'openai.com'],
    aliases: ['chatgpt', 'openai'],
  },
  {
    source: 'Perplexity',
    channel: 'ai',
    hosts: ['perplexity.ai'],
    aliases: ['perplexity'],
  },
  {
    source: 'Claude',
    channel: 'ai',
    hosts: ['claude.ai'],
    aliases: ['claude', 'anthropic'],
  },
  {
    source: 'Gemini',
    channel: 'ai',
    hosts: ['gemini.google.com', 'bard.google.com'],
    aliases: ['gemini'],
  },
  {
    source: 'Copilot',
    channel: 'ai',
    hosts: ['copilot.microsoft.com'],
    aliases: ['copilot'],
  },
  {
    source: 'Phind',
    channel: 'ai',
    hosts: ['phind.com'],
    aliases: ['phind'],
  },

  // Social networks & messaging
  {
    source: 'LinkedIn',
    channel: 'social',
    hosts: ['linkedin.com', 'lnkd.in'],
    aliases: ['linkedin', 'li', 'lnkd'],
    androidApps: ['com.linkedin.android'],
  },
  {
    source: 'X / Twitter',
    channel: 'social',
    hosts: ['t.co', 'twitter.com', 'x.com'],
    aliases: ['x', 'twitter', 'tco'],
    androidApps: ['com.twitter.android'],
  },
  {
    source: 'Instagram',
    channel: 'social',
    hosts: ['instagram.com'],
    aliases: ['instagram', 'ig', 'insta'],
    androidApps: ['com.instagram.android'],
  },
  {
    source: 'WhatsApp',
    channel: 'social',
    hosts: ['whatsapp.com', 'wa.me'],
    aliases: ['whatsapp', 'wpp', 'zap', 'wa'],
    androidApps: ['com.whatsapp', 'com.whatsapp.w4b'],
  },
  {
    source: 'Facebook',
    channel: 'social',
    hosts: ['facebook.com', 'fb.me', 'messenger.com'],
    aliases: ['facebook', 'fb'],
    androidApps: ['com.facebook.katana', 'com.facebook.orca', 'com.facebook.lite'],
  },
  {
    source: 'Threads',
    channel: 'social',
    hosts: ['threads.net', 'threads.com'],
    aliases: ['threads'],
  },
  {
    source: 'Bluesky',
    channel: 'social',
    hosts: ['bsky.app'],
    aliases: ['bluesky', 'bsky'],
  },
  {
    source: 'YouTube',
    channel: 'social',
    hosts: ['youtube.com', 'youtu.be'],
    aliases: ['youtube', 'yt'],
    androidApps: ['com.google.android.youtube'],
  },
  {
    source: 'Reddit',
    channel: 'social',
    hosts: ['reddit.com', 'redd.it'],
    aliases: ['reddit'],
    androidApps: ['com.reddit.frontpage'],
  },
  {
    source: 'Telegram',
    channel: 'social',
    hosts: ['t.me', 'telegram.org', 'web.telegram.org'],
    aliases: ['telegram', 'tg'],
    androidApps: ['org.telegram.messenger'],
  },
  {
    source: 'Discord',
    channel: 'social',
    hosts: ['discord.com', 'discord.gg', 'discordapp.com'],
    aliases: ['discord'],
  },
  {
    source: 'Slack',
    channel: 'social',
    hosts: ['slack.com'],
    aliases: ['slack'],
  },
  {
    source: 'TikTok',
    channel: 'social',
    hosts: ['tiktok.com'],
    aliases: ['tiktok'],
  },

  // Developer communities & code platforms
  {
    source: 'GitHub',
    channel: 'community',
    hosts: ['github.com', 'gist.github.com', 'github.io'],
    aliases: ['github', 'gh'],
  },
  {
    source: 'TabNews',
    channel: 'community',
    hosts: ['tabnews.com.br'],
    aliases: ['tabnews'],
  },
  {
    source: 'Hacker News',
    channel: 'community',
    hosts: ['news.ycombinator.com'],
    aliases: ['hackernews', 'hn', 'yc'],
  },
  {
    source: 'Dev.to',
    channel: 'community',
    hosts: ['dev.to'],
    aliases: ['devto', 'dev.to'],
  },
  {
    source: 'Medium',
    channel: 'community',
    hosts: ['medium.com'],
    aliases: ['medium'],
  },
  {
    source: 'Substack',
    channel: 'community',
    hosts: ['substack.com'],
    aliases: ['substack'],
  },
  {
    source: 'Stack Overflow',
    channel: 'community',
    hosts: ['stackoverflow.com'],
    aliases: ['stackoverflow'],
  },
  {
    source: 'Product Hunt',
    channel: 'community',
    hosts: ['producthunt.com'],
    aliases: ['producthunt'],
  },

  // Email / CV / Portfolio materials
  {
    source: 'E-mail',
    channel: 'campaign',
    hosts: ['mail.google.com', 'outlook.live.com', 'outlook.office.com', 'mail.yahoo.com'],
    aliases: ['email', 'mail', 'newsletter', 'assinatura'],
  },
  {
    source: 'Currículo PDF',
    channel: 'campaign',
    hosts: [],
    aliases: ['cv', 'resume', 'curriculo', 'currículo', 'pdf'],
  },
]

function stripSubdomainNoise(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/^(?:www|m|mobile|l|lm|out|old|web)\./, '')
}

function matchKnownByHost(rawHost: string): KnownOrigin | null {
  const lower = rawHost.trim().toLowerCase().replace(/:\d+$/, '')
  if (!lower) return null

  // Match Android app package names (`com.linkedin.android`)
  for (const origin of KNOWN_ORIGINS) {
    if (origin.androidApps?.some((pkg) => lower === pkg || lower.startsWith(`${pkg}.`))) {
      return origin
    }
  }

  // Exact or subdomain match against known domains
  const stripped = stripSubdomainNoise(lower)
  for (const origin of KNOWN_ORIGINS) {
    for (const candidate of origin.hosts) {
      if (
        lower === candidate ||
        stripped === candidate ||
        lower.endsWith(`.${candidate}`) ||
        stripped.endsWith(`.${candidate}`)
      ) {
        return origin
      }
    }
  }

  // Catch regional Google domains like google.com.ar, google.co.jp, google.ca
  if (/^(?:www\.|m\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?$/.test(lower)) {
    return KNOWN_ORIGINS[0]
  }
  return null
}

function matchKnownByAlias(rawAlias: string): KnownOrigin | null {
  const needle = rawAlias.trim().toLowerCase()
  if (!needle) return null
  for (const origin of KNOWN_ORIGINS) {
    if (origin.source.toLowerCase() === needle || origin.aliases?.includes(needle)) {
      return origin
    }
  }
  return matchKnownByHost(needle)
}

function channelFromMedium(medium: string | undefined): TrafficChannel | null {
  if (!medium) return null
  const m = medium.trim().toLowerCase()
  if (['organic', 'search', 'seo'].includes(m)) return 'organic'
  if (['social', 'social-media', 'profile', 'post', 'bio', 'dm', 'chat'].includes(m)) return 'social'
  if (['ai', 'llm', 'assistant'].includes(m)) return 'ai'
  if (['community', 'repo', 'readme', 'forum'].includes(m)) return 'community'
  if (['referral', 'partner', 'link'].includes(m)) return 'referral'
  if (['email', 'newsletter', 'cv', 'resume', 'pdf', 'cpc', 'ppc', 'paid', 'ads', 'qr', 'campaign'].includes(m)) {
    return 'campaign'
  }
  return null
}

function titleCaseSource(raw: string): string {
  const clean = raw.trim().replace(/[_-]+/g, ' ')
  if (!clean) return 'Direto'
  return clean
    .split(/\s+/)
    .map((word) => (word.length <= 2 ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1)))
    .join(' ')
}

export function isInternalOrEmptyHost(host: string | undefined, currentHost?: string): boolean {
  if (!host) return true
  const normalized = host.trim().toLowerCase().replace(/:\d+$/, '')
  if (
    !normalized ||
    normalized === 'direct' ||
    normalized === 'direto' ||
    normalized === 'internal' ||
    normalized === 'interno' ||
    normalized === 'unknown' ||
    OWN_HOSTS.has(normalized) ||
    isLocalOrPreviewHost(normalized)
  ) {
    return true
  }
  if (currentHost) {
    const cleanCurrent = currentHost.trim().toLowerCase().replace(/:\d+$/, '')
    if (normalized === cleanCurrent) return true
  }
  return false
}

/**
 * Resolves a clean `{ channel, source, referrerHost, utm* }` from URL query
 * parameters, `document.referrer`, or a stored legacy `referrerHost`.
 */
export function resolveAttribution(input: {
  referrer?: string
  referrerHost?: string
  search?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  currentHost?: string
  landingPath?: string
}): Attribution {
  const parsed = input.search ? parseUtmParams(input.search) : {}
  const utmSource = (input.utmSource ?? parsed.utmSource ?? parsed.ref)?.trim() || undefined
  const utmMedium = (input.utmMedium ?? parsed.utmMedium)?.trim() || undefined
  const utmCampaign = (input.utmCampaign ?? parsed.utmCampaign)?.trim() || undefined

  // Extract host from full referrer URL (including android-app:// schemes)
  let rawHost = (input.referrerHost ?? '').trim()
  if (input.referrer) {
    try {
      const refUrl = new URL(input.referrer)
      rawHost = refUrl.host || refUrl.hostname || rawHost
    } catch {
      /* keep rawHost */
    }
  }

  const externalHost = !isInternalOrEmptyHost(rawHost, input.currentHost)
    ? stripSubdomainNoise(rawHost)
    : ''

  // 1. Explicit UTM / ?ref= always wins — vital for WhatsApp, LinkedIn app, PDFs, email
  if (utmSource) {
    const known = matchKnownByAlias(utmSource)
    const mediumChannel = channelFromMedium(utmMedium)
    return {
      source: known ? known.source : titleCaseSource(utmSource),
      channel: mediumChannel ?? known?.channel ?? 'campaign',
      referrerHost: externalHost || utmSource.toLowerCase(),
      utmSource,
      ...(utmMedium ? { utmMedium } : {}),
      ...(utmCampaign ? { utmCampaign } : {}),
      ...(input.landingPath ? { landingPath: input.landingPath } : {}),
    }
  }

  // 2. External referrer
  if (externalHost) {
    const known = matchKnownByHost(rawHost) ?? matchKnownByHost(externalHost)
    return {
      source: known ? known.source : externalHost,
      channel: known ? known.channel : 'referral',
      referrerHost: externalHost,
      ...(utmMedium ? { utmMedium } : {}),
      ...(utmCampaign ? { utmCampaign } : {}),
      ...(input.landingPath ? { landingPath: input.landingPath } : {}),
    }
  }

  // 3. Direct
  return {
    source: 'Direto',
    channel: 'direct',
    referrerHost: 'Direct',
    ...(utmCampaign ? { utmCampaign } : {}),
    ...(input.landingPath ? { landingPath: input.landingPath } : {}),
  }
}

/** Normalizes a page path (removes trailing slash except root). */
export function normalizeAnalyticsPath(path: string | undefined): string {
  if (!path) return '/'
  const trimmed = path.trim()
  if (!trimmed || trimmed === '/') return '/'
  return trimmed.replace(/\/+$/, '') || '/'
}
