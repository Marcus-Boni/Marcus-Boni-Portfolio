import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'

import { useAuth } from '@/admin/AuthContext'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  glyph: string
  end?: boolean
}

const NAV: NavItem[] = [
  { to: '/admin', label: 'Painel', glyph: '◷', end: true },
  { to: '/admin/analytics', label: 'Audiência', glyph: '◔' },
  { to: '/admin/messages', label: 'Mensagens', glyph: '✉' },
  { to: '/admin/projects', label: 'Projetos', glyph: '▤' },
  { to: '/admin/experience', label: 'Carreira', glyph: '◫' },
  { to: '/admin/profile', label: 'Perfil & Stack', glyph: '◉' },
  { to: '/admin/settings', label: 'Ajustes', glyph: '⚙' },
]

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    'group flex items-center gap-3 px-4 py-2.5 font-mono text-[11px] tracking-[0.16em] uppercase transition-colors duration-300',
    isActive
      ? 'bg-ember/10 text-ember'
      : 'text-bone-dim hover:bg-ink-soft hover:text-bone',
  )
}

export function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/admin/login', { replace: true })
  }

  const navList = (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={() => setMenuOpen(false)}
          className={navClass}
        >
          <span aria-hidden className="text-base leading-none opacity-70">
            {item.glyph}
          </span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  )

  return (
    <div className="min-h-svh bg-ink text-bone">
      {/* ─── Sidebar (desktop) ─────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col justify-between border-r border-line bg-ink-soft/40 p-6 lg:flex">
        <div>
          <Link to="/admin" className="flex items-baseline gap-2">
            <span className="font-display-italic text-3xl">
              mb<span className="text-ember">.</span>
            </span>
            <span className="font-mono text-[10px] tracking-[0.3em] text-smoke uppercase">
              admin
            </span>
          </Link>
          <div className="mt-10">{navList}</div>
        </div>

        <SidebarFooter email={user?.email ?? ''} onLogout={handleLogout} />
      </aside>

      {/* ─── Topbar (mobile) ───────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-ink/90 px-5 py-4 backdrop-blur lg:hidden">
        <Link to="/admin" className="font-display-italic text-2xl">
          mb<span className="text-ember">.</span>
          <span className="ml-2 font-mono text-[10px] tracking-[0.3em] text-smoke uppercase">
            admin
          </span>
        </Link>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label="Menu"
          className="font-mono text-[11px] tracking-[0.2em] uppercase text-bone"
        >
          {menuOpen ? 'Fechar' : 'Menu'}
        </button>
      </header>

      {menuOpen && (
        <div className="sticky top-[57px] z-20 border-b border-line bg-ink-soft px-3 py-4 lg:hidden">
          {navList}
          <div className="mt-4 border-t border-line pt-4">
            <SidebarFooter
              email={user?.email ?? ''}
              onLogout={handleLogout}
            />
          </div>
        </div>
      )}

      {/* ─── Content ───────────────────────────────────────────── */}
      <main className="px-5 py-8 md:px-8 md:py-10 lg:ml-64 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function SidebarFooter({
  email,
  onLogout,
}: {
  email: string
  onLogout: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <Link
        to="/"
        className="font-mono text-[10px] tracking-[0.2em] text-smoke uppercase transition-colors hover:text-ember"
      >
        ← Ver site público
      </Link>
      <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
        <span className="truncate text-xs text-bone-dim" title={email}>
          {email || 'admin'}
        </span>
        <button
          onClick={onLogout}
          className="shrink-0 font-mono text-[10px] tracking-[0.2em] text-ember uppercase hover:underline"
        >
          Sair
        </button>
      </div>
    </div>
  )
}
