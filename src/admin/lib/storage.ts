import { getApp } from 'firebase/app'
import {
  deleteObject,
  getDownloadURL,
  getMetadata,
  getStorage,
  listAll,
  ref,
} from 'firebase/storage'

import { isFirebaseConfigured } from '@/lib/firebase-config'

/**
 * Read-side of the media bucket, for the Mídia page.
 *
 * Uploads land as `blog/{folder}/{id}/{width}.webp` (see `blog/lib/media.ts`),
 * so the hierarchy is folder → upload → variants. Nothing in the admin could
 * see that before: images were write-only, and an image dropped into a post
 * that was later deleted stayed in the bucket forever, paid for and invisible.
 *
 * Listing is lazy by level on purpose. `listAll` is one request per prefix, so
 * the page asks for folders first and only walks into one when it is opened.
 */

const ROOT = 'blog'

function storage() {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase Storage não está configurado.')
  }
  return getStorage(getApp())
}

export interface MediaVariant {
  width: number | null
  path: string
  bytes: number
  contentType: string
}

export interface MediaUpload {
  /** The `{id}` segment, or the file name for a loose upload. */
  id: string
  /** Full prefix (or file path) — what `deleteUpload` removes. */
  path: string
  /** Smallest variant, used as the thumbnail. */
  thumbUrl: string | null
  variants: MediaVariant[]
  bytes: number
  updatedAt: Date | null
  /** True for a single object sitting directly in the folder (a video clip). */
  loose: boolean
}

export interface MediaFolder {
  name: string
  path: string
  uploads: number
}

/** Top-level folders: one per post slug, plus `library` for body images. */
export async function listMediaFolders(): Promise<MediaFolder[]> {
  const root = await listAll(ref(storage(), ROOT))
  const folders = await Promise.all(
    root.prefixes.map(async (prefix) => {
      const inside = await listAll(prefix)
      return {
        name: prefix.name,
        path: prefix.fullPath,
        uploads: inside.prefixes.length + inside.items.length,
      }
    }),
  )
  return folders.sort((a, b) => a.name.localeCompare(b.name))
}

/** Everything inside one folder, grouped per upload. */
export async function listFolderUploads(path: string): Promise<MediaUpload[]> {
  const folder = await listAll(ref(storage(), path))

  const grouped = await Promise.all(
    folder.prefixes.map(async (prefix) => {
      const inside = await listAll(prefix)
      const variants = await Promise.all(
        inside.items.map(async (item) => {
          const meta = await getMetadata(item)
          return {
            width: Number.parseInt(item.name, 10) || null,
            path: item.fullPath,
            bytes: meta.size ?? 0,
            contentType: meta.contentType ?? 'application/octet-stream',
            updated: meta.updated ? new Date(meta.updated) : null,
          }
        }),
      )
      variants.sort((a, b) => (a.width ?? 0) - (b.width ?? 0))

      const smallest = inside.items.find(
        (item) => item.fullPath === variants[0]?.path,
      )

      return {
        id: prefix.name,
        path: prefix.fullPath,
        thumbUrl: smallest ? await getDownloadURL(smallest) : null,
        variants: variants.map(({ width, path: variantPath, bytes, contentType }) => ({
          width,
          path: variantPath,
          bytes,
          contentType,
        })),
        bytes: variants.reduce((total, variant) => total + variant.bytes, 0),
        updatedAt: variants[0]?.updated ?? null,
        loose: false,
      } satisfies MediaUpload
    }),
  )

  const loose = await Promise.all(
    folder.items.map(async (item) => {
      const meta = await getMetadata(item)
      const isImage = (meta.contentType ?? '').startsWith('image/')
      return {
        id: item.name,
        path: item.fullPath,
        thumbUrl: isImage ? await getDownloadURL(item) : null,
        variants: [
          {
            width: null,
            path: item.fullPath,
            bytes: meta.size ?? 0,
            contentType: meta.contentType ?? 'application/octet-stream',
          },
        ],
        bytes: meta.size ?? 0,
        updatedAt: meta.updated ? new Date(meta.updated) : null,
        loose: true,
      } satisfies MediaUpload
    }),
  )

  return [...grouped, ...loose].sort(
    (a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
  )
}

/** Removes every variant of an upload. A missing object is not a failure. */
export async function deleteUpload(upload: MediaUpload): Promise<void> {
  await Promise.all(
    upload.variants.map(async (variant) => {
      try {
        await deleteObject(ref(storage(), variant.path))
      } catch {
        /* already gone */
      }
    }),
  )
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
