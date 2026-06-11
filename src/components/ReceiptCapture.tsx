import { useEffect, useRef, useState } from 'react'
import { downscaleImage } from '../lib/image'
import { readReceipt, type ReceiptReading } from '../lib/ocr'

interface Props {
  onPhoto: (blob: Blob | null) => void
  onReading: (reading: ReceiptReading) => void
}

/** Capture/upload a receipt photo and auto-read its total when online. */
export function ReceiptCapture({ onPhoto, onReading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'reading' | 'read' | 'manual'>('idle')

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  async function handleFile(file: File) {
    setStatus('reading')
    // Downscale + convert to JPEG so big/HEIC phone photos are readable and small.
    let image: Blob = file
    try {
      image = await downscaleImage(file)
    } catch {
      image = file
    }

    if (preview) URL.revokeObjectURL(preview)
    setPreview(URL.createObjectURL(image))
    onPhoto(image)

    const reading = await readReceipt(image)
    onReading(reading)
    setStatus(reading.amount != null ? 'read' : 'manual')
  }

  function clear() {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setStatus('idle')
    onPhoto(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="rounded-2xl border border-dashed border-hairline bg-surface-soft p-3">
      {/* No `capture` attr: iOS then offers Camera AND Photo Library / Browse */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleFile(f)
        }}
      />

      {!preview ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-1.5 py-4 text-charcoal"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#777777" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.2l1-1.6A1 1 0 0 1 8.6 4h6.8a1 1 0 0 1 .9.4l1 1.6h1.2A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5Z" />
            <circle cx="12" cy="12.5" r="3.3" />
          </svg>
          <span className="text-sm font-semibold">Snap or upload a receipt</span>
          <span className="text-xs text-stone">We’ll read the total for you</span>
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <img src={preview} alt="receipt" className="h-16 w-16 rounded-lg object-cover" />
          <div className="flex-1 text-sm">
            {status === 'reading' && <span className="text-charcoal">Reading total…</span>}
            {status === 'read' && <span className="font-medium text-success-text">Total read — please confirm</span>}
            {status === 'manual' && (
              <span className="text-danger">Couldn’t read it — enter the amount</span>
            )}
          </div>
          <button type="button" onClick={clear} className="text-xs font-medium text-steel underline">
            Remove
          </button>
        </div>
      )}
    </div>
  )
}
