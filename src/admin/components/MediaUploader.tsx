import { useRef, useState, type ReactNode } from 'react'

import {
  AdminButton,
  Banner,
  Field,
  ProgressBar,
  TextInput,
} from '@/admin/components/ui'
import { rejectImage } from '@/blog/lib/media-limits'
import type { MediaRef } from '@/blog/types'
import { cn } from '@/lib/utils'

interface MediaUploaderProps {
  /** Where in Storage the variants land — usually the post slug. */
  folder: string
  /** Called with the finished ref once every variant is uploaded. */
  onUploaded: (media: MediaRef) => void
  label: string
  /** Rendered instead of the drop zone when something is already chosen. */
  preview?: ReactNode
  className?: string
  /** Asks for the alt text before uploading (covers and body images). */
  withAlt?: boolean
}

/**
 * Drag-and-drop image upload.
 *
 * The heavy lifting (downscale, WebP encode, LQIP, Storage upload) lives in
 * `blog/lib/media.ts` and is pulled in with a dynamic `import()` on first use,
 * so the Storage SDK never enters the admin's initial chunk — the dashboard and
 * the inbox have no business paying for it. The size/type check is the one
 * thing that runs eagerly, from `media-limits.ts`, so a 40 MB PNG is refused
 * instantly instead of after a minute of encoding.
 *
 * Alt text is asked for *before* the upload on purpose: typed while the image
 * is in front of you, it actually gets written.
 */
export function MediaUploader({
  folder,
  onUploaded,
  label,
  preview,
  className,
  withAlt = true,
}: MediaUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState<{ ratio: number; label: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [alt, setAlt] = useState('')

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return

    const rejection = rejectImage(file)
    if (rejection) {
      setError(rejection)
      return
    }

    setError(null)
    setProgress({ ratio: 0.05, label: 'Preparando…' })

    try {
      const { uploadImage } = await import('@/blog/lib/media')
      const media = await uploadImage(file, {
        folder,
        alt: alt.trim(),
        onProgress: ({ ratio, label: step }) => setProgress({ ratio, label: step }),
      })
      onUploaded(media)
      setAlt('')
      setProgress(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha no upload.')
      setProgress(null)
    }
  }

  const busy = progress !== null

  return (
    <div className={className}>
      {preview}

      {withAlt && (
        <Field
          label="Texto alternativo"
          className="mb-3"
          hint="Descreva a imagem. Vai para leitores de tela e para o card social."
        >
          <TextInput
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
            placeholder="Ex.: gráfico de latência antes e depois do cache"
            disabled={busy}
          />
        </Field>
      )}

      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          void handleFiles(event.dataTransfer.files)
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-3 border border-dashed px-4 py-8 text-center transition-colors',
          dragging ? 'border-ember bg-ember/5' : 'border-line',
        )}
      >
        <p className="font-mono text-[10px] tracking-[0.2em] text-smoke uppercase">
          {progress?.label ?? label}
        </p>

        {busy ? (
          <div className="w-full max-w-xs">
            <ProgressBar value={(progress?.ratio ?? 0) * 100} />
          </div>
        ) : (
          <p className="max-w-xs text-xs leading-relaxed text-smoke">
            Arraste aqui ou escolha um arquivo. O navegador gera as variantes de
            400/800/1600px em WebP antes de enviar — até 10 MB, JPG/PNG/WebP/AVIF/GIF.
          </p>
        )}

        <AdminButton
          type="button"
          onClick={() => inputRef.current?.click()}
          loading={busy}
        >
          {busy ? 'Enviando' : 'Escolher arquivo'}
        </AdminButton>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            void handleFiles(event.target.files)
            event.target.value = ''
          }}
        />
      </div>

      {error && (
        <div className="mt-3">
          <Banner tone="error" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        </div>
      )}
    </div>
  )
}
