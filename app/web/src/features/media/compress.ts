/**
 * Client-side image compression (T-011) — no paid service, no upload of the raw
 * full-resolution file. Staff snap a photo (often several MB from a phone camera);
 * this resizes + re-encodes to a small webp (~200 KB target) entirely in the
 * browser before it ever touches the network, keeping storage tiny (the $0 media
 * story, D-011) and uploads fast on hub wifi.
 *
 * Pure DOM/canvas — no dependency. Falls back to the original blob if the browser
 * can't encode webp (older Safari) so a capture is never lost.
 */
export interface CompressOptions {
  /** Longest edge in px after resize (default 1280 — plenty for a phone gallery). */
  maxDim?: number
  /** Soft byte target; quality steps down until met or the floor is hit (default 200 KB). */
  targetBytes?: number
  /** Output mime (default image/webp; falls back to image/jpeg if webp unsupported). */
  mimeType?: string
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

export async function compressImage(file: Blob, opts: CompressOptions = {}): Promise<Blob> {
  const maxDim = opts.maxDim ?? 1280
  const targetBytes = opts.targetBytes ?? 200 * 1024
  const mimeType = opts.mimeType ?? 'image/webp'

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file // not decodable as an image here — hand back untouched
  }

  let { width, height } = bitmap
  const longest = Math.max(width, height)
  if (longest > maxDim) {
    const scale = maxDim / longest
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close?.()
    return file
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  let quality = 0.82
  let blob = await canvasToBlob(canvas, mimeType, quality)
  // webp unsupported → canvas silently returns a png; retry as jpeg.
  if (blob && mimeType === 'image/webp' && blob.type !== 'image/webp') {
    blob = await canvasToBlob(canvas, 'image/jpeg', quality)
  }
  while (blob && blob.size > targetBytes && quality > 0.4) {
    quality -= 0.12
    const next = await canvasToBlob(canvas, blob.type || 'image/jpeg', quality)
    if (!next) break
    blob = next
  }

  return blob ?? file
}
