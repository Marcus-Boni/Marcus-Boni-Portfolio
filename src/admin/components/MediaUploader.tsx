import { useRef, useState } from 'react'

import { AdminButton, Banner } from '@/admin/components/ui'
import type { MediaRef } from '@/blog/types'
import { cn } from '@/lib/utils'

interface MediaUploaderProps {
  /** Where in Storage the variants land — usually the post slug. */
  folder: string
  /** Called with the finished ref once every variant is uploaded. */
  onUploaded: (media: MediaRef) => void
  label: string
  /** Rendered instead of the drop zone when something is already chosen. */
  preview?: React.ReactNode
  className?: string
}

/**
 * Drag-and-drop image upload.
 *
 * The heavy lifting (downscale, WebP encode, LQIP, Storage upload) lives in
 * `blog/lib/media.ts` and is pulled in with a dynamic `import()` on first use,
 * so the Storage SDK never enters the admin's initial chunk either — the
 * dashboard and the inbox have no business paying for it.
 */
export function MediaUploader({
  folder,
  onUploaded,
  label,
  preview,
  className,
}: MediaUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setError(null)
    setProgress('Preparando…')

    try {
      const { uploadImage } = await import('@/blog/lib/media')
      const media = await uploadImage(file, {
        folder,
        alt: '',
        onProgress: ({ label: step }) => setProgress(step),
      })
      onUploaded(media)
      setProgress(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha no upload.')
      setProgress(null)
    }
  }

  return (
    <div className={className}>
      {preview}

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
          {progress ?? label}
        </p>
        <p className="max-w-xs text-xs leading-relaxed text-smoke">
          Arraste aqui ou escolha um arquivo. O navegador gera as variantes de
          400/800/1600px em WebP antes de enviar.
        </p>
        <AdminButton
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={progress !== null}
        >
          {progress ? 'Enviando…' : 'Escolher arquivo'}
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
          <Banner tone="error">{error}</Banner>
        </div>
      )}
    </div>
  )
}
