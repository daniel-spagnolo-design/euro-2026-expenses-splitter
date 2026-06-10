import { useEffect, useState } from 'react'
import { db } from '../lib/db'
import { getSupabase, RECEIPTS_BUCKET } from '../lib/supabase'
import type { Expense } from '../lib/types'

/** Resolves a receipt image to a displayable URL — local blob first, then a
 *  signed Storage URL. Returns null when there's no receipt. */
export function useReceiptUrl(expense: Expense): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let revoke: string | null = null
    let cancelled = false

    async function resolve() {
      const local = await db.receipts.get(expense.id)
      if (local) {
        const objUrl = URL.createObjectURL(local.blob)
        revoke = objUrl
        if (!cancelled) setUrl(objUrl)
        return
      }
      if (expense.receipt_path) {
        const sb = getSupabase()
        if (sb) {
          const { data } = await sb.storage
            .from(RECEIPTS_BUCKET)
            .createSignedUrl(expense.receipt_path, 3600)
          if (!cancelled) setUrl(data?.signedUrl ?? null)
          return
        }
      }
      if (!cancelled) setUrl(null)
    }

    void resolve()
    return () => {
      cancelled = true
      if (revoke) URL.revokeObjectURL(revoke)
    }
  }, [expense.id, expense.receipt_path])

  return url
}

export function ReceiptThumb({ expense, onClick }: { expense: Expense; onClick?: () => void }) {
  const url = useReceiptUrl(expense)
  if (!url) return null
  return (
    <button onClick={onClick} className="shrink-0">
      <img src={url} alt="receipt" className="h-12 w-12 rounded-lg object-cover" />
    </button>
  )
}
