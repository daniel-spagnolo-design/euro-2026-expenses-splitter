/**
 * Downscale + re-encode a photo to JPEG before OCR/upload.
 *
 * Phone camera shots are often 5–12 MP (several MB) and sometimes HEIC — too
 * big for the vision model and not always a supported format. Drawing through a
 * canvas resizes them, respects EXIF orientation, and normalises to JPEG.
 */
export async function downscaleImage(
  file: Blob,
  maxDim = 1568,
  quality = 0.85,
): Promise<Blob> {
  let source: ImageBitmap | HTMLImageElement
  let revokeUrl: string | null = null

  if (typeof createImageBitmap === 'function') {
    try {
      source = await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      source = await loadViaImg(file)
      revokeUrl = (source as HTMLImageElement).src
    }
  } else {
    source = await loadViaImg(file)
    revokeUrl = (source as HTMLImageElement).src
  }

  const sw = 'width' in source ? source.width : (source as HTMLImageElement).naturalWidth
  const sh = 'height' in source ? source.height : (source as HTMLImageElement).naturalHeight
  const scale = Math.min(1, maxDim / Math.max(sw, sh))
  const w = Math.max(1, Math.round(sw * scale))
  const h = Math.max(1, Math.round(sh * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return file // canvas unavailable — fall back to original
  ctx.drawImage(source as CanvasImageSource, 0, 0, w, h)
  if ('close' in source) source.close()
  if (revokeUrl) URL.revokeObjectURL(revokeUrl)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  )
  return blob ?? file
}

function loadViaImg(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => resolve(img)
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not load image'))
    }
    img.src = url
  })
}
