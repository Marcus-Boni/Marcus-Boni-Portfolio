import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAdminContent } from '@/admin/AdminContentContext'
import { useAuth } from '@/admin/AuthContext'
import { useInbox } from '@/admin/InboxContext'
import { usePosts } from '@/admin/PostsContext'
import { CommandPalette } from '@/admin/components/CommandPalette'
import { ErrorBoundary } from '@/admin/components/ErrorBoundary'
import { Modal, useConfirm } from '@/admin/components/overlays'
import {
  Badge,
  CountBadge,
  Kbd,
  StatusDot,
  focusRing,
} from '@/admin/components/ui'
import { useHotkey } from '@/admin/hooks'
import { isFirebaseConfigured } from '@/lib/firebase'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  glyph: string
  end?: boolean
  /** Rendered at the right edge of the row. */
  badge?: 'unread' | 'drafts'
}

interface NavGroup {
  label: string
  items: NavItem[]
}

/**
 * Grouped navigation.
 *
 * Eight flat rows read as a pile; the same eight under three headings read as a
 * map — "o que está acontecendo", "o que eu publico", "como a máquina está".
 * The badges matter more than the grouping: unread messages and open drafts are
 * the two things worth seeing before deciding where to click.
 */
const NAV: NavGroup[] = [
  {
    label: 'Acompanhar',
    items: [
      { to: '/admin', label: 'Painel', glyph: '◷', end: true },
      { to: '/admin/analytics', label: 'Audiência', glyph: '◔' },
      { to: '/admin/messages', label: 'Mensagens', glyph: '✉', badge: 'unread' },
    ],
  },
  {
    label: 'Publicar',
    items: [
      { to: '/admin/blog', label: 'Blog', glyph: '✎', badge: 'drafts' },
      { to: '/admin/media', label: 'Mídia', glyph: '◱' },
    ],
  },
  {
    label: 'Site',
    items: [
      { to: '/admin/projects', label: 'Projetos', glyph: '▤' },
      { to: '/admin/experience', label: 'Carreira', glyph: '◫' },
      { to: '/admin/profile', label: 'Perfil & Stack', glyph: '◉' },
      { to: '/admin/settings', label: 'Ajustes', glyph: '⚙' },
    ],
  },
]

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['Ctrl', 'K'], label: 'Abrir a paleta de comandos' },
  { keys: ['Ctrl', 'S'], label: 'Salvar a página em edição' },
  { keys: ['Ctrl', 'B'], label: 'Negrito no editor de post' },
  { keys: ['Ctrl', 'I'], label: 'Itálico no editor de post' },
  { keys: ['Ctrl', 'K'], label: 'Link no editor de post (com o cursor no texto)' },
  { keys: ['Esc'], label: 'Fechar diálogo, paleta ou busca' },
  { keys: ['?'], label: 'Esta lista' },
]

export function AdminLayout() {
  const { user, logout } = useAuth()
  const { dirty, saving } = useAdminContent()
  const { unread } = useInbox()
  const { counts } = usePosts()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const location = useLocation()

  const [menuOpen, setMenuOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  useHotkey({ key: 'k', mod: true }, () => setPaletteOpen((open) => !open))
  useHotkey({ key: '?' }, () => setShortcutsOpen(true))

  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  const handleLogout = async () => {
    if (dirty) {
      const leave = await confirm({
        title: 'Sair com alterações não salvas?',
        description:
          'Você editou o conteúdo do site e ainda não salvou. Sair agora descarta essas alterações.',
        confirmLabel: 'Sair e descartar',
        tone: 'danger',
      })
      if (!leave) return
    }
    await logout()
    navigate('/admin/login', { replace: true })
  }

  const badgeFor = (item: NavItem) => {
    if (item.badge === 'unread') return unread
    if (item.badge === 'drafts') return counts.draft
    return 0
  }

  const navList = (
    <nav aria-label="Seções do painel" className="flex flex-col gap-6">
      {NAV.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-4 font-mono text-[9px] tracking-[0.28em] text-smoke/70 uppercase">
            {group.label}
          </p>
          <ul className="flex flex-col">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  // The drawer is a route-scoped overlay: navigating closes it.
                  // Leaving it open behind the new page is how you end up
                  // tapping the next link twice.
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 border-l-2 px-4 py-2.5 font-mono text-[11px] tracking-[0.16em] uppercase transition-colors duration-200',
                      focusRing,
                      isActive
                        ? 'border-ember bg-ember/10 text-ember'
                        : 'border-transparent text-bone-dim hover:bg-ink-soft hover:text-bone',
                    )
                  }
                >
                  <span aria-hidden className="text-base leading-none opacity-70">
                    {item.glyph}
                  </span>
                  <span className="flex-1">{item.label}</span>
                  <CountBadge
                    count={badgeFor(item)}
                    tone={item.badge === 'unread' ? 'ember' : 'muted'}
                  />
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )

  const brand = (
    <Link
      to="/admin"
      onClick={() => setMenuOpen(false)}
      className={cn('flex items-baseline gap-2', focusRing)}
    >
      <span className="font-display-italic text-3xl">
        mb<span className="text-ember">.</span>
      </span>
      <span className="font-mono text-[10px] tracking-[0.3em] text-smoke uppercase">
        admin
      </span>
    </Link>
  )

  return (
    <div className="min-h-svh bg-ink text-bone">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[95] focus:border focus:border-ember focus:bg-ink focus:px-4 focus:py-2 focus:font-mono focus:text-[11px] focus:tracking-[0.18em] focus:text-ember focus:uppercase"
      >
        Ir para o conteúdo
      </a>

      {/* ─── Sidebar (desktop) ─────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col justify-between border-r border-line bg-ink-soft/40 py-6 lg:flex">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="px-6">{brand}</div>
          <div className="mt-8">{navList}</div>
        </div>
        <div className="px-6">
          <PaletteButton onClick={() => setPaletteOpen(true)} />
          <SidebarFooter
            email={user?.email ?? ''}
            dirty={dirty}
            saving={saving}
            onLogout={handleLogout}
          />
        </div>
      </aside>

      {/* ─── Topbar (mobile) ───────────────────────────────────── */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-line bg-ink/90 px-5 py-3.5 backdrop-blur lg:hidden">
        {brand}
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.16em] text-ember uppercase">
              <StatusDot tone="live" pulse /> não salvo
            </span>
          )}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Buscar"
            className={cn(
              'border border-line px-2.5 py-1.5 font-mono text-xs text-bone-dim transition-colors hover:border-ember hover:text-ember',
              focusRing,
            )}
          >
            ⌕
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-expanded={menuOpen}
            aria-label="Abrir menu"
            className={cn(
              'relative border border-line px-3 py-1.5 font-mono text-[11px] tracking-[0.18em] text-bone uppercase transition-colors hover:border-ember hover:text-ember',
              focusRing,
            )}
          >
            Menu
            {unread > 0 && (
              <span
                aria-hidden
                className="absolute -top-1 -right-1 size-2 bg-ember"
              />
            )}
          </button>
        </div>
      </header>

      {/* Drawer. A slide-over rather than the old push-down block: the page
          keeps its scroll position, and the overlay makes it obvious that the
          menu is modal. */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 cursor-default bg-ink/80 backdrop-blur-sm motion-safe:animate-[fade-in_160ms_ease-out]"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu do painel"
            className="absolute inset-y-0 right-0 flex w-[min(20rem,85vw)] flex-col justify-between border-l border-line bg-ink-soft py-6 shadow-[0_0_60px_rgba(0,0,0,0.6)] motion-safe:animate-[panel-in_220ms_cubic-bezier(0.16,1,0.3,1)]"
          >
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between px-6">
                {brand}
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Fechar menu"
                  className={cn(
                    'font-mono text-sm text-smoke transition-colors hover:text-ember',
                    focusRing,
                  )}
                >
                  ✕
                </button>
              </div>
              <div className="mt-8">{navList}</div>
            </div>
            <div className="px-6">
              <SidebarFooter
                email={user?.email ?? ''}
                dirty={dirty}
                saving={saving}
                onLogout={handleLogout}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── Content ───────────────────────────────────────────── */}
      <main
        id="admin-main"
        className="px-5 py-8 md:px-8 md:py-10 lg:ml-64 lg:px-12"
      >
        <div className="mx-auto max-w-6xl">
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>

      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onShowShortcuts={() => setShortcutsOpen(true)}
        />
      )}

      <Modal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        title="Atalhos"
        description="No macOS, troque Ctrl por ⌘."
        size="md"
      >
        <ul className="flex flex-col divide-y divide-line">
          {SHORTCUTS.map((shortcut) => (
            <li
              key={`${shortcut.keys.join('+')}-${shortcut.label}`}
              className="flex items-center justify-between gap-6 py-2.5"
            >
              <span className="text-sm text-bone-dim">{shortcut.label}</span>
              <span className="flex shrink-0 items-center gap-1">
                {shortcut.keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  )
}

function PaletteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'mb-5 flex w-full items-center gap-2 border border-line px-3 py-2 text-left font-mono text-[10px] tracking-[0.16em] text-smoke uppercase transition-colors hover:border-bone/40 hover:text-bone-dim',
        focusRing,
      )}
    >
      <span aria-hidden>⌕</span>
      <span className="flex-1">Buscar</span>
      <Kbd>Ctrl</Kbd>
      <Kbd>K</Kbd>
    </button>
  )
}

function SidebarFooter({
  email,
  dirty,
  saving,
  onLogout,
}: {
  email: string
  dirty: boolean
  saving: boolean
  onLogout: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {!isFirebaseConfigured && (
        <Badge tone="warn" title="Sem VITE_FIREBASE_* no ambiente">
          modo demo
        </Badge>
      )}

      <span className="flex items-center gap-2 font-mono text-[9px] tracking-[0.16em] text-smoke uppercase">
        <StatusDot
          tone={saving ? 'live' : dirty ? 'idle' : isFirebaseConfigured ? 'live' : 'off'}
          pulse={saving}
        />
        {saving ? 'salvando…' : dirty ? 'alterações não salvas' : 'conteúdo sincronizado'}
      </span>

      <a
        href="/"
        target="_blank"
        rel="noreferrer"
        className={cn(
          'font-mono text-[10px] tracking-[0.2em] text-smoke uppercase transition-colors hover:text-ember',
          focusRing,
        )}
      >
        ↗ Ver site público
      </a>

      <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
        <span className="truncate text-xs text-bone-dim" title={email}>
          {email || 'admin'}
        </span>
        <button
          type="button"
          onClick={onLogout}
          className={cn(
            'shrink-0 font-mono text-[10px] tracking-[0.2em] text-ember uppercase hover:underline',
            focusRing,
          )}
        >
          Sair
        </button>
      </div>
    </div>
  )
}
