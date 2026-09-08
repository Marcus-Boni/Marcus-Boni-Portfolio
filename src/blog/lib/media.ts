import { getApp } from 'firebase/app'
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
} from 'firebase/storage'

import { isFirebaseConfigured } from '@/lib/firebase-config'

import type { MediaRef } from '../types'

/**
 * Client-side image pipeline: the browser downscales and re-encodes to WebP
 * *before* anything is uploaded, so Storage only ever holds the variants the
 * site actually serves. No Cloud Function, no image CDN, no cold start — and
 * on Blaze the bill stays proportional to what readers download.
 *
 * `firebase/storage` is imported only here and by the admin editor, keeping the
 * Storage SDK out of the public blog chunk.
 */

/** Widths emitted for every upload; the largest also becomes `src`. */
const WIDTHS = [400, 800, 1600] as const

/** Blur-up placeholder width. 20px of WebP is ~400 bytes as a data URI. */
const LQIP_WIDTH = 20

const QUALITY = 0.82

/** Hard ceiling mirrored in `storage.rules` — reject early, with a clear message. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
]

export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm']

function storage() {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase Storage não está configurado.')
  }
  return getStorage(getApp())
}

function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 8)
  }
  return Math.random().toString(36).slice(2, 10)
}

/** Draws `bitmap` at `width`, preserving aspect ratio, and encodes to WebP. */
async function encodeAt(
  bitmap: ImageBitmap,
  width: number,
  quality = QUALITY,
): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = Math.min(1, width / bitmap.width)
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D indisponível neste navegador.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, w, h)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', quality),
  )
  if (!blob) throw new Error('Falha ao codificar a imagem em WebP.')
  return { blob, width: w, height: h }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Falha ao ler o placeholder.'))
    reader.readAsDataURL(blob)
  })
}

export interface UploadProgress {
  /** 0–1, coarse: one step per variant. */
  ratio: number
  label: string
}

/**
 * Resizes, encodes and uploads one image, returning the `MediaRef` the renderer
 * consumes. Variants wider than the source are skipped — upscaling a 900px
 * screenshot to 1600px only wastes bytes.
 */
export async function uploadImage(
  file: File,
  options: {
    alt?: string
    caption?: string
    folder?: string
    onProgress?: (progress: UploadProgress) => void
  } = {},
): Promise<MediaRef> {
  const { alt = '', caption, folder = 'library', onProgress } = options

  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(`Formato não suportado: ${file.type || 'desconhecido'}`)
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Limite: 10 MB.`,
    )
  }

  const bitmap = await createImageBitmap(file)
  try {
    const id = uid()
    const basePath = `blog/${folder}/${id}`
    const targets = WIDTHS.filter(
      (w, index) => w <= bitmap.width || index === 0,
    )
    // A source narrower than 400px still deserves one variant at its own size.
    const widths = targets.length > 0 ? targets : [WIDTHS[0]]

    const variants: MediaRef['variants'] = []
    let largest = { width: bitmap.width, height: bitmap.height }

    for (const [index, width] of widths.entries()) {
      onProgress?.({
        ratio: index / (widths.length + 1),
        label: `Enviando ${width}px…`,
      })
      const encoded = await encodeAt(bitmap, width)
      const objectRef = ref(storage(), `${basePath}/${encoded.width}.webp`)
      await uploadBytes(objectRef, encoded.blob, {
        contentType: 'image/webp',
        cacheControl: 'public, max-age=31536000, immutable',
      })
      const url = await getDownloadURL(objectRef)
      variants.push({ width: encoded.width, url })
      largest = { width: encoded.width, height: encoded.height }
    }

    onProgress?.({ ratio: 0.9, label: 'Gerando placeholder…' })
    const lqipBlob = await encodeAt(bitmap, LQIP_WIDTH, 0.6)
    const lqip = await blobToDataUrl(lqipBlob.blob)

    onProgress?.({ ratio: 1, label: 'Concluído' })
    variants.sort((a, b) => a.width - b.width)

    return {
      src: variants[variants.length - 1].url,
      variants,
      lqip,
      width: largest.width,
      height: largest.height,
      alt,
      caption,
      storagePath: basePath,
    }
  } finally {
    bitmap.close()
  }
}

/**
 * Uploads a short video as-is (no transcoding in the browser). Long-form video
 * belongs on YouTube/Vimeo via the `::youtube` directive — Storage egress is
 * the least predictable line on a Blaze bill.
 */
export async function uploadVideo(
  file: File,
  folder = 'library',
): Promise<{ url: string; storagePath: string }> {
  if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
    throw new Error('Use MP4 ou WebM para clipes curtos.')
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      'Vídeo acima de 10 MB — publique no YouTube/Vimeo e use ::youtube.',
    )
  }
  const path = `blog/${folder}/${uid()}-${file.name.replace(/[^\w.-]/g, '_')}`
  const objectRef = ref(storage(), path)
  await uploadBytes(objectRef, file, {
    contentType: file.type,
    cacheControl: 'public, max-age=31536000, immutable',
  })
  return { url: await getDownloadURL(objectRef), storagePath: path }
}

/** Deletes every variant of an upload. Missing objects are not an error. */
export async function deleteMedia(media: MediaRef): Promise<void> {
  if (!media.storagePath) return
  await Promise.all(
    media.variants.map(async (variant) => {
      try {
        await deleteObject(ref(storage(), `${media.storagePath}/${variant.width}.webp`))
      } catch {
        /* already gone — deleting twice is not a failure */
      }
    }),
  )
}

/** `srcset` string for a `MediaRef`. */
export function toSrcSet(media: MediaRef): string {
  return media.variants.map((v) => `${v.url} ${v.width}w`).join(', ')
}
