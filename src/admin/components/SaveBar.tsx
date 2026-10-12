import { useAdminContent } from '@/admin/AdminContentContext'
import { useConfirm } from '@/admin/components/overlays'
import { useToast } from '@/admin/components/toast'
import { AdminButton, Kbd, StatusDot } from '@/admin/components/ui'
import { useHotkey } from '@/admin/hooks'
import { isFirebaseConfigured } from '@/lib/firebase'
import { cn } from '@/lib/utils'

/**
 * The save bar every content page ends with.
 *
 * Three things it now does that it did not: it answers to Ctrl+S (the reflex
 * everyone has, previously swallowed by the browser's "save page"), it names
 * the sections with pending changes instead of a bare "alterações não salvas",
 * and a failed write says so — the old version resolved silently and left you
 * believing the edit was published.
 */
export function SaveBar() {
  const { dirty, saving, save, revert, changed, savedAt, error } = useAdminContent()
  const confirm = useConfirm()
  const toast = useToast()

  const onSave = async () => {
    if (!dirty || saving || !isFirebaseConfigured) return
    const ok = await save()
    if (ok) toast.success('Conteúdo publicado no site.')
    else toast.error('Não foi possível salvar. Veja o detalhe na barra.')
  }

  const onRevert = async () => {
    const yes = await confirm({
      title: 'Descartar alterações?',
      description: `Isso volta ${changed.join(', ')} ao que está publicado. Não dá para desfazer.`,
      confirmLabel: 'Descartar',
      tone: 'danger',
    })
    if (!yes) return
    revert()
    toast.info('Alterações descartadas.')
  }

  useHotkey({ key: 's', mod: true }, () => void onSave())

  const status = !isFirebaseConfigured
    ? 'Modo demo — alterações não persistem'
    : saving
      ? 'Salvando…'
      : dirty
        ? `Não salvo: ${changed.join(' · ')}`
        : savedAt
          ? `Salvo às ${savedAt.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}`
          : 'Tudo salvo'

  return (
    <div className="sticky bottom-4 z-20 mt-8">
      <div
        className={cn(
          'flex flex-col gap-3 border bg-ink-soft/95 px-5 py-3 backdrop-blur transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-4',
          error ? 'border-ember-deep/70' : dirty ? 'border-ember/50' : 'border-line',
        )}
      >
        <div className="min-w-0">
          <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-smoke uppercase">
            <StatusDot
              tone={saving ? 'live' : dirty ? 'idle' : 'live'}
              pulse={saving}
            />
            <span className="truncate">{status}</span>
          </span>
          {error && (
            <p className="mt-1 text-xs break-words text-ember">{error}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="mr-1 hidden items-center gap-1 font-mono text-[9px] tracking-[0.16em] text-smoke/70 uppercase lg:flex">
            <Kbd>Ctrl</Kbd>
            <Kbd>S</Kbd>
          </span>
          <AdminButton
            variant="ghost"
            onClick={() => void onRevert()}
            disabled={!dirty || saving}
          >
            Descartar
          </AdminButton>
          <AdminButton
            variant="solid"
            onClick={() => void onSave()}
            loading={saving}
            disabled={!dirty || !isFirebaseConfigured}
            title={
              !isFirebaseConfigured
                ? 'Configure o Firebase para publicar'
                : dirty
                  ? 'Publicar as alterações'
                  : 'Nada para salvar'
            }
          >
            {saving ? 'Salvando' : 'Salvar alterações'}
          </AdminButton>
        </div>
      </div>
    </div>
  )
}
