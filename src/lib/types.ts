export type Currency = 'EUR' | 'GBP' | 'AUD'
export type PaidBy = 'wife' | 'me'

export const CURRENCIES: Currency[] = ['EUR', 'GBP', 'AUD']

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  EUR: '€',
  GBP: '£',
  AUD: 'A$',
}

export interface Expense {
  id: string
  trip_id: string
  amount: number
  currency: Currency
  paid_by: PaidBy
  is_business: boolean
  note: string
  /** Storage object key once uploaded; null while only a local blob exists. */
  receipt_path: string | null
  spent_at: string // ISO timestamp
  /** The include/exclude toggle. Inactive expenses stay in the list but leave all totals. */
  is_active: boolean
  updated_at: string // ISO timestamp, also the sync watermark
  deleted: boolean
}

export interface Trip {
  id: string
  name: string
  owe_percentage: number
  home_currency: Currency
  join_code: string
  created_at: string
}

/** A pending receipt photo held locally until it can be uploaded. */
export interface QueuedReceipt {
  expense_id: string
  blob: Blob
  content_type: string
}

export type OutboxOp = 'upsert' | 'delete'

export interface OutboxItem {
  /** Auto-incremented Dexie key. */
  seq?: number
  op: OutboxOp
  expense_id: string
  queued_at: string
}

/** Cached FX rates expressed as units of <currency> per 1 EUR (EUR base). */
export interface RateCache {
  base: 'EUR'
  rates: Record<Currency, number>
  fetched_at: string
  /** True when the user has hand-edited rates and we should not auto-overwrite. */
  manual: boolean
}
