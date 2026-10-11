/**
 * Upload limits, with no Firebase import.
 *
 * `media.ts` pulls in `firebase/storage`, so anything that merely wants to
 * *validate* a file before uploading — the admin's drop zone, the paste
 * handler — would drag the Storage SDK into the admin's initial chunk just to
 * read a number. These constants live here so the check is free and the SDK
 * still arrives only when a byte is actually being sent.
 *
 * The ceiling mirrors `storage.rules`; changing one without the other turns a
 * clear client-side message into an opaque rules rejection.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
]

export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm']

/** Returns the reason the file cannot be uploaded, or `null` when it can. */
export function rejectImage(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return `Formato não suportado: ${file.type || 'desconhecido'}. Use JPG, PNG, WebP, AVIF ou GIF.`
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Limite: 10 MB.`
  }
  return null
}
