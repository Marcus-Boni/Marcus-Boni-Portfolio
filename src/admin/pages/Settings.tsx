import { useState, type ReactNode } from 'react'

import { useAdminContent } from '@/admin/AdminContentContext'
import { useAuth } from '@/admin/AuthContext'
import {
  AdminButton,
  Badge,
  Banner,
  Card,
  Field,
  PageHeader,
  SectionLabel,
  Spinner,
  TextArea,
} from '@/admin/components/ui'
import { ensureContentIds } from '@/content/ids'
import type { SiteContent } from '@/content/types'
import { isFirebaseConfigured } from '@/lib/firebase'

export function Settings() {
  const { draft, loading, update, resetToDefaults, saving } = useAdminContent()
  const { user } = useAuth()
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')
  const [importOk, setImportOk] = useState(false)

  if (loading) return <Spinner label="Carregando" />

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `portfolio-content-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importJson = () => {
    setImportError('')
    setImportOk(false)
    try {
      const parsed = JSON.parse(importText) as Partial<SiteContent>
      if (!parsed.profile || !Array.isArray(parsed.projects)) {
        throw new Error('Estrutura inválida')
      }
      update((d) =>
        ensureContentIds({
          profile: { ...d.profile, ...parsed.profile },
          projects: parsed.projects ?? d.projects,
          experience: parsed.experience ?? d.experience,
          techStack: parsed.techStack ?? d.techStack,
          socials: parsed.socials ?? d.socials,
        }),
      )
      setImportOk(true)
      setImportText('')
    } catch {
      setImportError('JSON inválido. Verifique o conteúdo colado.')
    }
  }

  const onReset = async () => {
    if (
      !window.confirm(
        'Restaurar todo o conteúdo para os valores padrão? Isso sobrescreve o que está publicado.',
      )
    )
      return
    await resetToDefaults()
  }

  return (
    <>
      <PageHeader
        title="Ajustes"
        subtitle="Conexão, conta, backup do conteúdo e ações destrutivas."
      />

      <div className="flex flex-col gap-6">
        <Card>
          <SectionLabel>Status da conexão</SectionLabel>
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
                {import.meta.env.VITE_FIREBASE_PROJECT_ID || '—'}
              </span>
            </Row>
            <Row label="Conta">
              <span className="text-bone-dim">{user?.email ?? '—'}</span>
            </Row>
            <Row label="Última atualização do conteúdo">
              <span className="font-mono text-xs text-smoke">
                {draft.updatedAt
                  ? new Date(draft.updatedAt).toLocaleString('pt-BR')
                  : 'nunca'}
              </span>
            </Row>
          </div>
          {!isFirebaseConfigured && (
            <div className="mt-4">
              <Banner tone="warn">
                Configure as variáveis <span className="font-mono">VITE_FIREBASE_*</span>{' '}
                e publique as regras de <span className="font-mono">firestore.rules</span>{' '}
                (passo a passo em <span className="font-mono">ADMIN_SETUP.md</span>).
              </Banner>
            </div>
          )}
        </Card>

        <Card>
          <SectionLabel>Backup do conteúdo</SectionLabel>
          <p className="mb-4 text-sm text-bone-dim">
            Exporte um instantâneo de todo o conteúdo editável ou restaure a
            partir de um arquivo exportado anteriormente.
          </p>
          <div className="flex flex-wrap gap-3">
            <AdminButton variant="outline" onClick={exportJson}>
              ↓ Exportar JSON
            </AdminButton>
          </div>

          <div className="mt-6">
            <Field label="Importar JSON" hint="Cole o conteúdo de um export anterior">
              <TextArea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='{ "profile": { … }, "projects": [ … ] }'
                className="min-h-32 font-mono text-xs"
              />
            </Field>
            <div className="mt-3 flex items-center gap-3">
              <AdminButton
                variant="solid"
                onClick={importJson}
                disabled={!importText.trim()}
              >
                Aplicar import
              </AdminButton>
              {importError && (
                <span className="text-xs text-ember">{importError}</span>
              )}
              {importOk && (
                <span className="text-xs text-bone-dim">
                  Importado — revise e salve nas outras abas.
                </span>
              )}
            </div>
          </div>
        </Card>

        <Card className="border-ember-deep/40">
          <SectionLabel>Zona de risco</SectionLabel>
          <p className="mb-4 max-w-lg text-sm text-bone-dim">
            Restaura todo o conteúdo (perfil, projetos, carreira, stack e redes)
            para os valores originais do código e publica imediatamente.
          </p>
          <AdminButton
            variant="danger"
            onClick={onReset}
            disabled={saving || !isFirebaseConfigured}
          >
            {saving ? 'Restaurando…' : 'Restaurar padrões'}
          </AdminButton>
        </Card>
      </div>
    </>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-2 last:border-0">
      <span className="font-mono text-[10px] tracking-[0.2em] text-smoke uppercase">
        {label}
      </span>
      {children}
    </div>
  )
}
