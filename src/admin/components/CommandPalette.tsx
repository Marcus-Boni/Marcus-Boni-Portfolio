import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAdminContent } from '@/admin/AdminContentContext'
import { useInbox } from '@/admin/InboxContext'
import { usePosts } from '@/admin/PostsContext'
import { useToast } from '@/admin/components/toast'
import { Kbd, TextInput } from '@/admin/components/ui'
import { exportContentJson } from '@/admin/lib/backup'
import { cn } from '@/lib/utils'

/**
 * Command palette (⌘K / Ctrl+K).
 *
 * The admin has ten pages and a few dozen editable entities; a sidebar gets you
 * to the page, but not to *the project called Ledger* or *that draft about
 * Postgres*. This indexes destinations, the actions worth reaching without
 * navigating first, every post, and every content entity — so the answer to
 * "where do I change this?" is always the same keystroke.
 */

interface Command {
  id: string
  label: string
  group: 'Ações' | 'Navegação' | 'Blog' | 'Conteúdo'
  /** Extra words matched against the query but not displayed. */
  keywords?: string
  hint?: string
  run: () => void
}

const NAV: { to: string; label: string; keywords: string }[] = [
  { to: '/admin', label: 'Painel', keywords: 'dashboard home início visão geral' },
  { to: '/admin/analytics', label: 'Audiência', keywords: 'analytics métricas visitas gráficos' },
  { to: '/admin/messages', label: 'Mensagens', keywords: 'inbox contato caixa de entrada' },
  { to: '/admin/blog', label: 'Blog', keywords: 'posts artigos rascunhos' },
  { to: '/admin/media', label: 'Mídia', keywords: 'imagens storage uploads capas' },
  { to: '/admin/projects', label: 'Projetos', keywords: 'trabalho work portfolio' },
  { to: '/admin/experience', label: 'Carreira', keywords: 'experiência clientes timeline' },
  { to: '/admin/profile', label: 'Perfil & Stack', keywords: 'bio sobre tecnologias redes sociais' },
  { to: '/admin/settings', label: 'Ajustes', keywords: 'settings backup firebase conta' },
]

/** Subsequence match: "prj" finds "Projetos". Accent-insensitive. */
function matches(query: string, haystack: string): boolean {
  if (!query) return true
  const needle = normalize(query)
  const target = normalize(haystack)
  if (target.includes(needle)) return true
  let cursor = 0
  for (const char of needle) {
    cursor = target.indexOf(char, cursor)
    if (cursor === -1) return false
    cursor += 1
  }
  return true
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

/**
 * Mounted only while open (see `AdminLayout`), so the query and the highlighted
 * row start fresh on every ⌘K instead of being reset by an effect.
 */
export function CommandPalette({
  onClose,
  onShowShortcuts,
}: {
  onClose: () => void
  onShowShortcuts: () => void
}) {
  const navigate = useNavigate()
  const toast = useToast()
  const { draft, dirty, save, revert } = useAdminContent()
  const { posts } = usePosts()
  const { unread, markAllRead } = useInbox()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const commands = useMemo<Command[]>(() => {
    const go = (to: string) => () => {
      navigate(to)
      onClose()
    }

    const items: Command[] = []

    /* Actions first: they are the reason to open the palette mid-edit. */
    items.push({
      id: 'action:new-post',
      label: 'Novo post',
      group: 'Ações',
      keywords: 'escrever artigo criar blog',
      run: go('/admin/blog/new'),
    })
    if (dirty) {
      items.push({
        id: 'action:save',
        label: 'Salvar alterações do conteúdo',
        group: 'Ações',
        hint: 'Ctrl+S',
        keywords: 'publicar gravar',
        run: () => {
          onClose()
          void save()
        },
      })
      items.push({
        id: 'action:revert',
        label: 'Descartar alterações não salvas',
        group: 'Ações',
        keywords: 'reverter desfazer',
        run: () => {
          revert()
          onClose()
          toast.info('Alterações descartadas.')
        },
      })
    }
    items.push({
      id: 'action:export',
      label: 'Exportar conteúdo (JSON)',
      group: 'Ações',
      keywords: 'backup download salvar arquivo',
      run: () => {
        const name = exportContentJson(draft)
        onClose()
        toast.success(`Backup gerado — ${name}`)
      },
    })
    if (unread > 0) {
      items.push({
        id: 'action:read-all',
        label: `Marcar ${unread} mensagem(ns) como lida(s)`,
        group: 'Ações',
        keywords: 'inbox limpar',
        run: () => {
          onClose()
          void markAllRead().then(() => toast.success('Caixa de entrada zerada.'))
        },
      })
    }
    items.push({
      id: 'action:site',
      label: 'Abrir o site público',
      group: 'Ações',
      keywords: 'ver preview home',
      hint: 'nova aba',
      run: () => {
        window.open('/', '_blank', 'noopener')
        onClose()
      },
    })
    items.push({
      id: 'action:shortcuts',
      label: 'Ver atalhos de teclado',
      group: 'Ações',
      keywords: 'ajuda teclas shortcuts',
      run: () => {
        onClose()
        onShowShortcuts()
      },
    })

    for (const item of NAV) {
      items.push({
        id: `nav:${item.to}`,
        label: item.label,
        group: 'Navegação',
        keywords: item.keywords,
        run: go(item.to),
      })
    }

    for (const post of posts.slice(0, 40)) {
      items.push({
        id: `post:${post.slug}`,
        label: post.title || post.slug,
        group: 'Blog',
        hint: post.status === 'published' ? 'publicado' : post.status === 'draft' ? 'rascunho' : 'não listado',
        keywords: `${post.slug} ${post.tags.join(' ')}`,
        run: go(`/admin/blog/${post.slug}`),
      })
    }

    for (const project of draft.projects) {
      items.push({
        id: `project:${project.id}`,
        label: project.title,
        group: 'Conteúdo',
        hint: 'projeto',
        keywords: `projeto trabalho ${project.stack.join(' ')} ${project.year}`,
        run: go('/admin/projects'),
      })
    }
    for (const entry of draft.experience.projects) {
      items.push({
        id: `exp:${entry.id}`,
        label: entry.client,
        group: 'Conteúdo',
        hint: 'carreira',
        keywords: `cliente experiência ${entry.stack.join(' ')}`,
        run: go('/admin/experience'),
      })
    }

    return items
  }, [
    navigate,
    onClose,
    onShowShortcuts,
    dirty,
    save,
    revert,
    draft,
    posts,
    unread,
    markAllRead,
    toast,
  ])

  const results = useMemo(
    () =>
      commands
        .filter((command) =>
          matches(query, `${command.label} ${command.keywords ?? ''} ${command.group}`),
        )
        .slice(0, 40),
    [commands, query],
  )

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [active])

  // A shorter result set can leave the highlight past the end; clamp on render
  // rather than resetting it from an effect.
  const activeIndex = Math.min(active, Math.max(results.length - 1, 0))

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => (results.length ? (index + 1) % results.length : 0))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) =>
        results.length ? (index - 1 + results.length) % results.length : 0,
      )
    } else if (event.key === 'Enter') {
      event.preventDefault()
      results[activeIndex]?.run()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  let lastGroup = ''

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/85 backdrop-blur-sm motion-safe:animate-[fade-in_160ms_ease-out]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Paleta de comandos"
        onKeyDown={onKeyDown}
        className="relative w-full max-w-xl border border-line bg-ink-soft shadow-[0_24px_80px_rgba(0,0,0,0.6)] motion-safe:animate-[panel-in_220ms_cubic-bezier(0.16,1,0.3,1)]"
      >
        <div className="border-b border-line p-3">
          <TextInput
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
            }}
            placeholder="Buscar páginas, posts, projetos ou ações…"
            className="border-0 bg-transparent px-1 text-base focus:border-0"
            aria-label="Buscar comandos"
          />
        </div>

        {results.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-smoke">
            Nada encontrado para “{query}”.
          </p>
        ) : (
          <ul ref={listRef} className="max-h-[52vh] overflow-y-auto py-2">
            {results.map((command, index) => {
              const groupChanged = command.group !== lastGroup
              lastGroup = command.group
              return (
                <li key={command.id}>
                  {groupChanged && (
                    <p className="px-4 pt-3 pb-1.5 font-mono text-[9px] tracking-[0.25em] text-smoke uppercase">
                      {command.group}
                    </p>
                  )}
                  <button
                    type="button"
                    data-active={index === activeIndex}
                    onMouseMove={() => setActive(index)}
                    onClick={command.run}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                      index === activeIndex ? 'bg-ember/10 text-bone' : 'text-bone-dim',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'font-mono text-[10px]',
                        index === activeIndex ? 'text-ember' : 'text-smoke',
                      )}
                    >
                      ↵
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{command.label}</span>
                    {command.hint && (
                      <span className="shrink-0 font-mono text-[9px] tracking-[0.16em] text-smoke uppercase">
                        {command.hint}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <footer className="flex items-center gap-4 border-t border-line px-4 py-2.5 font-mono text-[9px] tracking-[0.16em] text-smoke uppercase">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navegar
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd> abrir
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <Kbd>Esc</Kbd> fechar
          </span>
        </footer>
      </div>
    </div>
  )
}
