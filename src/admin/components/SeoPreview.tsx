import { SectionHeader } from '@/admin/components/ui'
import { autoExcerpt } from '@/blog/lib/text'
import type { Post } from '@/blog/types'
import { DEFAULT_OG, postUrl, SITE_NAME, SITE_URL } from '../../../netlify/lib/blog-seo'

type PreviewPost = Pick<Post, 'title' | 'slug' | 'excerpt' | 'body' | 'cover' | 'status'>

/** The same editable metadata powers both approximate previews. */
export function SeoPreview({ post }: { post: PreviewPost }) {
  const title = post.title.trim() || 'Título do artigo'
  const description = post.excerpt.trim() || autoExcerpt(post.body) ||
    'Escreva um resumo que explique o que o leitor encontrará neste artigo.'
  const url = postUrl(post.slug || 'slug-do-artigo')
  const image = post.cover?.src || DEFAULT_OG

  return (
    <div className="mt-6 border-t border-line pt-5">
      <SectionHeader
        label="Prévia de busca e compartilhamento"
        hint="Atualizada enquanto você escreve. É uma simulação: cada plataforma pode ajustar título, resumo e recorte da imagem."
      />
      <div className="grid gap-5 md:grid-cols-2">
        <div className="min-w-0 border border-line bg-ink p-4">
          <p className="mb-3 font-mono text-[10px] tracking-[0.16em] text-smoke uppercase">
            Resultado de busca
          </p>
          <p className="break-all text-xs text-bone-dim">{url}</p>
          <p className="mt-2 line-clamp-2 text-lg text-ember">{title} — {SITE_NAME}</p>
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-bone-dim">{description}</p>
        </div>
        <div className="min-w-0 overflow-hidden border border-line bg-ink">
          <img
            src={image}
            alt={post.cover ? post.cover.alt || 'Prévia da capa do artigo' : 'Imagem padrão de compartilhamento do site'}
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
        {!post.excerpt.trim() && ' O resumo exibido foi extraído do corpo.'}
      </p>
    </div>
  )
}
