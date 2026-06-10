import Dexie, { type Table } from 'dexie'
import type { Expense, OutboxItem, QueuedReceipt, RateCache, Trip } from './types'

/**
 * Local-first store. Every read/write hits this first so the UI is instant and
 * works offline; sync.ts reconciles it with Supabase when a connection exists.
 */
class AppDB extends Dexie {
  expenses!: Table<Expense, string>
  outbox!: Table<OutboxItem, number>
  receipts!: Table<QueuedReceipt, string>
  trip!: Table<Trip, string>
  /** Small key/value store: rate cache, sync watermark, active trip id, etc. */
  meta!: Table<{ key: string; value: unknown }, string>

  constructor() {
    super('euro2026')
    this.version(1).stores({
      expenses: 'id, trip_id, spent_at, updated_at, deleted',
      outbox: '++seq, expense_id',
      receipts: 'expense_id',
      trip: 'id',
      meta: 'key',
    })
  }
}

export const db = new AppDB()

// --- meta helpers ---------------------------------------------------------

export async function metaGet<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key)
  return row?.value as T | undefined
}

export async function metaSet(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}

export const META = {
  rates: 'rates' as const,
  syncWatermark: 'sync_watermark' as const,
  activeTripId: 'active_trip_id' as const,
}

export type { RateCache }
