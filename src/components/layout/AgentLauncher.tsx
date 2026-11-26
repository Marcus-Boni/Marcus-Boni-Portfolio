import { Suspense, lazy, useCallback, useEffect, useState } from 'react'

import { OPEN_AGENT_EVENT, type OpenAgentDetail } from '@/lib/agent-trigger'

/**
 * Tiny zero-weight launcher mounted on the home route (`App.tsx`).
 *
 * Keeps the entire agent runtime + UI completely out of the home's 4 static
 * chunks until a visitor explicitly presses `⌘K` / `Ctrl+K` or clicks the
 * Header/Contact dossier trigger.
 */
const LazyAgentDrawer = lazy(() => import('@/agent/AgentDrawer'))

export function AgentLauncher() {
  const [open, setOpen] = useState(false)
  const [initialPrompt, setInitialPrompt] = useState<string | undefined>(undefined)

  const handleClose = useCallback(() => {
    setOpen(false)
    setInitialPrompt(undefined)
  }, [])

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<OpenAgentDetail>).detail
      if (detail?.lens) {
        void import('@/agent/session').then(({ setAgentLens }) => setAgentLens(detail.lens!))
      }
      setInitialPrompt(detail?.prompt)
      setOpen(true)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        const target = event.target as HTMLElement | null
        const tag = target?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
        event.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    window.addEventListener(OPEN_AGENT_EVENT, onOpen)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener(OPEN_AGENT_EVENT, onOpen)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  if (!open) return null

  return (
    <Suspense fallback={null}>
      <LazyAgentDrawer initialPrompt={initialPrompt} onClose={handleClose} />
    </Suspense>
  )
}
