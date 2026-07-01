import { useState } from 'react'

import { useAdminContent } from '@/admin/AdminContentContext'
import { AdminButton } from '@/admin/components/ui'
import { isFirebaseConfigured } from '@/lib/firebase'
import { cn } from '@/lib/utils'

/** Sticky action bar shown on every content-editing page. */
export function SaveBar() {
  const { dirty, saving, save, revert } = useAdminContent()
  const [saved, setSaved] = useState(false)

  const onSave = async () => {
    await save()
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2200)
  }

  return (
    <div className="sticky bottom-4 z-20 mt-8">
      <div
        className={cn(
          'flex items-center justify-between gap-4 border bg-ink-soft/95 px-5 py-3 backdrop-blur transition-colors',
          dirty ? 'border-ember/50' : 'border-line',
        )}
      >
        <span className="font-mono text-[10px] tracking-[0.18em] text-smoke uppercase">
          {!isFirebaseConfigured
            ? 'Modo demo — alterações não persistem'
            : saving
              ? 'Salvando…'
              : saved
                ? 'Salvo ✓'
                : dirty
                  ? 'Alterações não salvas'
                  : 'Tudo salvo'}
        </span>
        <div className="flex items-center gap-2">
          <AdminButton variant="ghost" onClick={revert} disabled={!dirty || saving}>
            Descartar
          </AdminButton>
          <AdminButton
            variant="solid"
            onClick={onSave}
            disabled={!dirty || saving || !isFirebaseConfigured}
          >
            Salvar alterações
          </AdminButton>
        </div>
      </div>
    </div>
  )
}
