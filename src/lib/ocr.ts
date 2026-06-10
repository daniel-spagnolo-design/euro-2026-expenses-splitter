import { getSupabase } from './supabase'
import type { Currency } from './types'

export interface ReceiptReading {
  amount: number | null
  currency: Currency | null
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Ask the read-receipt Edge Function to extract the total + currency.
 * Returns nulls (rather than throwing) when offline or unconfigured so the
 * caller can fall back to manual entry.
 */
export async function readReceipt(blob: Blob): Promise<ReceiptReading> {
  const sb = getSupabase()
  if (!sb || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return { amount: null, currency: null }
  }
  try {
    const base64 = await blobToBase64(blob)
    const { data, error } = await sb.functions.invoke('read-receipt', {
      body: { image: base64, media_type: blob.type || 'image/jpeg' },
    })
    if (error) throw error
    const reading = data as ReceiptReading
    return {
      amount: typeof reading.amount === 'number' ? reading.amount : null,
      currency: reading.currency ?? null,
    }
  } catch (err) {
    console.warn('receipt OCR failed, falling back to manual', err)
    return { amount: null, currency: null }
  }
}
