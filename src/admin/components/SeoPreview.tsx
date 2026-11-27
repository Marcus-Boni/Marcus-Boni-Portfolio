import { useState } from 'react'

import { Badge, SectionHeader, Segmented } from '@/admin/components/ui'
import { autoExcerpt } from '@/blog/lib/text'
import type { Post } from '@/blog/types'
import type { Locale } from '@/i18n/translations'
import { cn } from '@/lib/utils'
import { DEFAULT_OG, postUrl, SITE_NAME, SITE_URL } from '../../../netlify/lib/blog-seo'

type PreviewPost = Pick<
  Post,
  'title' | 'slug' | 'excerpt' | 'body' | 'cover' | 'status' | 'lang' | 'locales' | 'bodies'
>

type SerpDevice = 'desktop' | 'mobile'

function lengthTone(len: number, min: number, max: number): 'ember' | 'neutral' | 'warn' {
  if (len === 0) return 'warn'
  if (len >= min && len <= max) return 'ember'
  return 'neutral'
}

/** The same editable metadata powers both approximate previews. */
export function SeoPreview({ post, lang }: { post: PreviewPost; lang?: Locale }) {
  const [device, setDevice] = useState<SerpDevice>('desktop')

  const activeLang = lang ?? post.lang ?? 'pt'
  const entry = post.locales?.[activeLang]
  const rawTitle = entry ? entry.title : activeLang === post.lang ? post.title : ''
  const rawExcerpt = entry ? entry.excerpt : activeLang === post.lang ? post.excerpt : ''
  const rawBody =
    post.bodies?.[activeLang] !== undefined
      ? post.bodies[activeLang]!
      : activeLang === post.lang
        ? post.body
        : ''
  const hasPt = Boolean(post.locales?.pt?.title?.trim() || (post.lang === 'pt' && post.title.trim()))
  const hasEn = Boolean(post.locales?.en?.title?.trim() || (post.lang === 'en' && post.title.trim()))
  const bilingual = hasPt && hasEn

  const title = rawTitle.trim() || (activeLang === 'en' ? 'Article title' : 'Título do artigo')
  const fullTitle = `${title} — ${SITE_NAME}`
  const description =
    rawExcerpt.trim() ||
    autoExcerpt(rawBody) ||
    (activeLang === 'en'
      ? 'Write a summary explaining what readers will learn in this article.'
      : 'Escreva um resumo que explique o que o leitor encontrará neste artigo.')
  const url = postUrl(post.slug || 'slug-do-artigo', bilingual && activeLang === 'en' ? 'en' : 'pt')
  const image = post.cover?.src || DEFAULT_OG
  const coverAlt = entry?.coverAlt?.trim() || post.cover?.alt

  const titleChars = rawTitle.trim().length
  const fullTitleChars = fullTitle.length
  const descChars = (rawExcerpt.trim() || autoExcerpt(rawBody)).length

  return (
    <div className="mt-6 border-t border-line pt-5">
      <SectionHeader
        label={`Prévia de busca e compartilhamento (${activeLang.toUpperCase()})`}
        hint="Atualizada enquanto você escreve. É uma simulação: cada plataforma pode ajustar título, resumo e recorte da imagem."
        action={
          <Segmented
            size="sm"
            label="Formato da prévia de busca"
            value={device}
            onChange={setDevice}
            options={[
              { value: 'desktop', label: 'Desktop' },
              { value: 'mobile', label: 'Mobile' },
            ]}
          />
        }
      />

      {/* Technical SEO & editorial length telemetry */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={lengthTone(fullTitleChars, 35, 65)} title="Com o sufixo da marca (referência ~50–65 caracteres)">
          Title: {titleChars}c ({fullTitleChars}c c/ marca)
        </Badge>
        <Badge tone={lengthTone(descChars, 110, 160)} title="Referência editorial ~120–160 caracteres">
          Meta desc: {descChars}c
        </Badge>
        <Badge tone={post.status === 'published' ? 'ember' : 'muted'}>
          {post.status === 'published' ? 'index, follow' : post.status === 'unlisted' ? 'noindex, follow' : 'rascunho'}
        </Badge>
        {bilingual && <Badge tone="ember">hreflang PT · EN</Badge>}
        <Badge tone="neutral">BlogPosting + Breadcrumb</Badge>
        {post.cover && (
          <Badge tone={coverAlt?.trim() ? 'neutral' : 'warn'}>
            OG {post.cover.width}×{post.cover.height}
          </Badge>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="min-w-0 border border-line bg-ink p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="font-mono text-[10px] tracking-[0.16em] text-smoke uppercase">
              Resultado de busca
            </p>
            <span className="font-mono text-[9px] tracking-[0.16em] text-smoke uppercase">
              {device === 'mobile' ? '360px · mobile' : '600px · desktop'}
            </span>
          </div>
          <div className={cn(device === 'mobile' && 'max-w-[21rem] border-l border-line pl-3')}>
            <p className="break-all text-xs text-bone-dim">{url}</p>
            <p
              className={cn(
                'mt-2 text-ember',
                device === 'mobile' ? 'line-clamp-2 text-base leading-snug' : 'line-clamp-2 text-lg',
              )}
            >
              {fullTitle}
            </p>
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-bone-dim">
              {description}
            </p>
          </div>
        </div>
        <div className="min-w-0 overflow-hidden border border-line bg-ink">
          <img
            src={image}
            alt={post.cover ? coverAlt || 'Prévia da capa do artigo' : 'Imagem padrão de compartilhamento do site'}
            loading="lazy"
            className="aspect-[1.91/1] w-full object-cover"
          />
          <div className="p-4">
            <p className="mb-2 font-mono text-[10px] tracking-[0.16em] text-smoke uppercase">
              Compartilhamento · {new URL(SITE_URL).hostname}
            </p>
            <p className="line-clamp-2 text-lg text-bone">{title}</p>
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-bone-dim">{description}</p>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-smoke">
        {post.status === 'published'
          ? 'Publicado: elegível para busca após salvar. A indexação depende dos mecanismos de busca.'
          : post.status === 'unlisted'
            ? 'Não listado: acessível pelo link, com instrução para não indexar.'
            : 'Rascunho: esta prévia é local. O artigo ainda não está disponível ao público.'}
        {!rawExcerpt.trim() && ' O resumo exibido foi extraído do corpo.'}
      </p>
    </div>
  )
}
