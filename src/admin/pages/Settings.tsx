import { useRef, useState, type ReactNode } from 'react'

import { useAdminContent } from '@/admin/AdminContentContext'
import { useAuth } from '@/admin/AuthContext'
import { usePosts } from '@/admin/PostsContext'
import { SaveBar } from '@/admin/components/SaveBar'
import { useConfirm } from '@/admin/components/overlays'
import { useToast } from '@/admin/components/toast'
import {
  AdminButton,
  Badge,
  Banner,
  Card,
  CopyButton,
  Field,
  PageHeader,
  SectionHeader,
  Spinner,
  StatusDot,
  TextArea,
} from '@/admin/components/ui'
import { exportContentJson, parseContentJson, type ImportPreview } from '@/admin/lib/backup'
import { isFirebaseConfigured } from '@/lib/firebase'
import { firebaseConfig } from '@/lib/firebase-config'
import { cn } from '@/lib/utils'

/**
 * Every env var the admin reads.
 *
 * Read through `firebaseConfig` rather than indexing `import.meta.env` with a
 * variable: Vite inlines only *static* `import.meta.env.VITE_X` accesses, so a
 * computed lookup works in dev and silently returns undefined in the build.
 */
const ENV_KEYS: {
  key: string
  required: boolean
  field: keyof typeof firebaseConfig
}[] = [
  { key: 'VITE_FIREBASE_API_KEY', required: true, field: 'apiKey' },
  { key: 'VITE_FIREBASE_AUTH_DOMAIN', required: false, field: 'authDomain' },
  { key: 'VITE_FIREBASE_PROJECT_ID', required: true, field: 'projectId' },
  { key: 'VITE_FIREBASE_STORAGE_BUCKET', required: false, field: 'storageBucket' },
  {
    key: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
    required: false,
    field: 'messagingSenderId',
  },
  { key: 'VITE_FIREBASE_APP_ID', required: true, field: 'appId' },
]

/**
 * Diagnostics, backup and the one destructive button.
 *
 * The old page could tell you Firebase was "modo demo" but not *why*; now every
 * variable is listed with its state, so a missing `VITE_FIREBASE_APP_ID` is a
 * line you can read instead of a mystery. Import gained a file picker, a drop
 * zone and a diff preview — pasting a JSON blob and hoping was the only option
 * before — and the reset button now asks you to type the word, because it
 * overwrites what is published the moment it is pressed.
 */
export function Settings() {
  const { draft, loading, replace, resetToDefaults, saving } = useAdminContent()
  const { user } = useAuth()
  const { counts } = usePosts()
  const confirm = useConfirm()
  const toast = useToast()

  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  if (loading) return <Spinner label="Carregando" />

  const env = ENV_KEYS.map((entry) => ({
    ...entry,
    present: Boolean(firebaseConfig[entry.field]),
  }))
  const missingRequired = env.filter((entry) => entry.required && !entry.present)

  const readFile = async (file: File | undefined) => {
    if (!file) return
    if (!file.name.endsWith('.json')) {
      setImportError('Escolha o arquivo .json gerado pelo export.')
      return
    }
    const text = await file.text()
    setImportText(text)
    inspect(text)
  }

  const inspect = (text: string) => {
    setImportError('')
    setPreview(null)
    try {
      setPreview(parseContentJson(text, draft))
    } catch (cause) {
      setImportError(cause instanceof Error ? cause.message : 'JSON inválido.')
    }
  }

  const applyImport = () => {
    if (!preview) return
    replace(preview.content)
    setPreview(null)
    setImportText('')
    toast.success('Import aplicado ao rascunho. Revise e salve.')
  }

  const onReset = async () => {
    const yes = await confirm({
      title: 'Restaurar todo o conteúdo?',
      description:
        'Perfil, projetos, carreira, stack e redes voltam aos valores do código e são publicados imediatamente. O blog e as mensagens não são afetados.',
      confirmLabel: 'Restaurar padrões',
      requireText: 'RESTAURAR',
      tone: 'danger',
    })
    if (!yes) return
    const ok = await resetToDefaults()
    if (ok) toast.success('Conteúdo restaurado para os padrões do código.')
    else toast.error('Não foi possível restaurar.')
  }

  return (
    <>
      <PageHeader
        title="Ajustes"
        subtitle="Conexão, conta, backup do conteúdo e ações destrutivas."
        meta={
          <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-smoke uppercase">
            <StatusDot tone={isFirebaseConfigured ? 'live' : 'off'} />
            {isFirebaseConfigured ? 'Firebase conectado' : 'modo demo'}
          </span>
        }
      />

      <div className="flex flex-col gap-6">
        {/* ─── Conexão ─────────────────────────────────────────── */}
        <Card>
          <SectionHeader
            label="Status da conexão"
            hint="Os valores VITE_* são embutidos no bundle na hora do build — mudar o .env exige um novo deploy."
          />
          <div className="flex flex-col gap-3 text-sm">
            <Row label="Firebase">
              {isFirebaseConfigured ? (
                <Badge tone="ember">conectado</Badge>
              ) : (
                <Badge tone="muted">modo demo</Badge>
              )}
            </Row>
            <Row label="Projeto">
              <span className="font-mono text-xs text-bone-dim">
                {firebaseConfig.projectId || '—'}
              </span>
            </Row>
            <Row label="Conta">
              <span className="text-bone-dim">{user?.email ?? '—'}</span>
            </Row>
            <Row label="UID (regras do Firestore)">
              <span className="flex items-center gap-3">
                <span className="font-mono text-[11px] break-all text-smoke">
                  {user?.uid ?? '—'}
                </span>
                {user?.uid && <CopyButton value={user.uid} />}
              </span>
            </Row>
            <Row label="Conteúdo publicado em">
              <span className="font-mono text-xs text-smoke">
                {draft.updatedAt
                  ? new Date(draft.updatedAt).toLocaleString('pt-BR')
                  : 'nunca'}
              </span>
            </Row>
            <Row label="Blog">
              <span className="font-mono text-xs text-smoke">
                {counts.published} publicado(s) · {counts.unlisted} não listado(s) ·{' '}
                {counts.draft} rascunho(s)
              </span>
            </Row>
          </div>

          <div className="mt-5 border-t border-line pt-5">
            <SectionHeader label="Variáveis de ambiente" />
            <ul className="grid gap-2 sm:grid-cols-2">
              {env.map((entry) => (
                <li key={entry.key} className="flex items-center gap-2">
                  <StatusDot tone={entry.present ? 'live' : entry.required ? 'off' : 'idle'} />
                  <span
                    className={cn(
                      'font-mono text-[11px]',
                      entry.present ? 'text-bone-dim' : 'text-smoke',
                    )}
                  >
                    {entry.key}
                  </span>
                  {!entry.present && entry.required && <Badge tone="warn">falta</Badge>}
                </li>
              ))}
            </ul>
          </div>

          {missingRequired.length > 0 && (
            <div className="mt-4">
              <Banner tone="warn" title="Configuração incompleta">
                Sem{' '}
                <span className="font-mono">
                  {missingRequired.map((entry) => entry.key).join(', ')}
                </span>{' '}
                o painel roda em modo demo. O passo a passo está em{' '}
                <span className="font-mono">docs/ADMIN_SETUP.md</span>; depois
                publique as regras de <span className="font-mono">firestore.rules</span> e{' '}
                <span className="font-mono">storage.rules</span>.
              </Banner>
            </div>
          )}
        </Card>

        {/* ─── Backup ──────────────────────────────────────────── */}
        <Card>
          <SectionHeader
            label="Backup do conteúdo"
            hint="Exporta perfil, projetos, carreira, stack e redes. O blog vive em outra coleção e não entra neste arquivo."
            action={
              <AdminButton
                variant="outline"
                onClick={() => {
                  const name = exportContentJson(draft)
                  toast.success(`Backup gerado — ${name}`)
                }}
              >
                ↓ Exportar JSON
              </AdminButton>
            }
          />

          <div
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              void readFile(event.dataTransfer.files[0])
            }}
            className={cn(
              'flex flex-col items-center gap-3 border border-dashed px-4 py-8 text-center transition-colors',
              dragging ? 'border-ember bg-ember/5' : 'border-line',
            )}
          >
            <p className="font-mono text-[10px] tracking-[0.2em] text-smoke uppercase">
              Restaurar de um export
            </p>
            <p className="max-w-sm text-xs leading-relaxed text-smoke">
              Arraste o arquivo <span className="font-mono">.json</span> aqui, escolha
              do computador ou cole o conteúdo abaixo. Nada é publicado até você
              conferir o resumo e salvar.
            </p>
            <AdminButton variant="subtle" onClick={() => fileRef.current?.click()}>
              Escolher arquivo
            </AdminButton>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                void readFile(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          </div>

          <div className="mt-5">
            <Field label="Ou cole o JSON" hint="Conteúdo de um export anterior">
              <TextArea
                value={importText}
                onChange={(event) => {
                  setImportText(event.target.value)
                  setPreview(null)
                  setImportError('')
                }}
                placeholder='{ "profile": { … }, "projects": [ … ] }'
                className="min-h-32 font-mono text-xs"
              />
            </Field>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <AdminButton
                variant="outline"
                onClick={() => inspect(importText)}
                disabled={!importText.trim()}
              >
                Conferir
              </AdminButton>
              <AdminButton variant="solid" onClick={applyImport} disabled={!preview}>
                Aplicar ao rascunho
              </AdminButton>
              {importError && <span className="text-xs text-ember">{importError}</span>}
            </div>
          </div>

          {preview && (
            <div className="mt-5 border border-ember/40 bg-ember/5 p-4">
              <SectionHeader label="O que muda" />
              <ul className="flex flex-col divide-y divide-line">
                {preview.changes.map((change) => (
                  <li
                    key={change.label}
                    className="flex items-center justify-between gap-4 py-2 text-sm"
                  >
                    <span className="text-bone-dim">{change.label}</span>
                    <span className="font-mono text-xs tabular-nums">
                      <span className="text-smoke">{change.from}</span>
                      <span className="mx-2 text-smoke">→</span>
                      <span
                        className={cn(
                          change.from === change.to ? 'text-smoke' : 'text-ember',
                        )}
                      >
                        {change.to}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* ─── Documentação ────────────────────────────────────── */}
        <Card>
          <SectionHeader
            label="Documentação"
            hint="Tudo que este painel assume está escrito, no repositório."
          />
          <ul className="grid gap-2 sm:grid-cols-2">
            {[
              { file: 'docs/ADMIN_SETUP.md', what: 'Firebase, regras, primeiro acesso' },
              { file: 'docs/ANALYTICS.md', what: 'Definição de cada métrica' },
              { file: 'docs/BLOG.md', what: 'Modelo de dados e SEO do blog' },
              { file: 'docs/AGENTS.md', what: 'Como o site responde a crawlers' },
            ].map((doc) => (
              <li key={doc.file} className="flex flex-col gap-0.5 border border-line p-3">
                <span className="font-mono text-[11px] text-bone-dim">{doc.file}</span>
                <span className="text-xs text-smoke">{doc.what}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* ─── Zona de risco ───────────────────────────────────── */}
        <Card className="border-ember-deep/40">
          <SectionHeader
            label="Zona de risco"
            hint="Exporte um backup antes. Esta ação publica na hora, sem passar pelo botão Salvar."
          />
          <p className="mb-4 max-w-lg text-sm text-bone-dim">
            Restaura todo o conteúdo (perfil, projetos, carreira, stack e redes)
            para os valores originais do código e publica imediatamente.
          </p>
          <AdminButton
            variant="danger"
            onClick={() => void onReset()}
            loading={saving}
            disabled={!isFirebaseConfigured}
          >
            {saving ? 'Restaurando' : 'Restaurar padrões'}
          </AdminButton>
        </Card>
      </div>

      <SaveBar />
    </>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line py-2 last:border-0">
      <span className="font-mono text-[10px] tracking-[0.2em] text-smoke uppercase">
        {label}
      </span>
      {children}
    </div>
  )
}
