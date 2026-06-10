import { db, META, metaGet, metaSet } from './db'
import { getSupabase, RECEIPTS_BUCKET } from './supabase'
import type { Expense, Trip } from './types'

type Listener = (state: SyncState) => void

export interface SyncState {
  status: 'idle' | 'syncing' | 'offline' | 'error'
  lastSyncedAt: string | null
  pending: number
}

let state: SyncState = { status: 'idle', lastSyncedAt: null, pending: 0 }
const listeners = new Set<Listener>()
let timer: ReturnType<typeof setTimeout> | null = null
let running = false

export function subscribeSync(fn: Listener): () => void {
  listeners.add(fn)
  fn(state)
  return () => listeners.delete(fn)
}

async function emit(patch: Partial<SyncState>) {
  state = { ...state, ...patch, pending: await db.outbox.count() }
  listeners.forEach((l) => l(state))
}

/** Debounced trigger so rapid edits coalesce into one sync. */
export function scheduleSync(delay = 600): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void sync(), delay)
}

/** Push the local outbox, then pull remote changes. Safe to call anytime. */
export async function sync(): Promise<void> {
  if (running) return
  const sb = getSupabase()
  if (!sb) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await emit({ status: 'offline' })
    return
  }
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) return

  running = true
  await emit({ status: 'syncing' })
  try {
    await pushOutbox()
    await pullChanges()
    const now = new Date().toISOString()
    await emit({ status: 'idle', lastSyncedAt: now })
  } catch (err) {
    console.error('sync failed', err)
    await emit({ status: 'error' })
  } finally {
    running = false
  }
}

async function pushOutbox(): Promise<void> {
  const sb = getSupabase()!
  // Collapse to the latest op per expense (outbox is ordered by seq).
  const items = await db.outbox.orderBy('seq').toArray()
  const latest = new Map<string, (typeof items)[number]>()
  for (const it of items) latest.set(it.expense_id, it)

  for (const item of latest.values()) {
    const expense = await db.expenses.get(item.expense_id)
    if (!expense) continue

    // Upload a queued receipt photo before sending the row.
    if (!expense.receipt_path) {
      const queued = await db.receipts.get(expense.id)
      if (queued) {
        const ext = queued.content_type.includes('png') ? 'png' : 'jpg'
        const path = `${expense.trip_id}/${expense.id}.${ext}`
        const up = await sb.storage
          .from(RECEIPTS_BUCKET)
          .upload(path, queued.blob, { contentType: queued.content_type, upsert: true })
        if (!up.error) {
          expense.receipt_path = path
          await db.expenses.put(expense)
          await db.receipts.delete(expense.id)
        }
      }
    }

    const { error } = await sb.from('expenses').upsert(toRow(expense))
    if (error) throw error
  }

  await db.outbox.clear()
  await emit({})
}

async function pullChanges(): Promise<void> {
  const sb = getSupabase()!
  const watermark = (await metaGet<string>(META.syncWatermark)) ?? '1970-01-01T00:00:00.000Z'

  const { data, error } = await sb
    .from('expenses')
    .select('*')
    .gt('updated_at', watermark)
    .order('updated_at', { ascending: true })
  if (error) throw error

  let maxTs = watermark
  for (const row of data ?? []) {
    const remote = fromRow(row)
    const local = await db.expenses.get(remote.id)
    // Last-write-wins; a local edit pending in the outbox stays untouched.
    if (!local || remote.updated_at >= local.updated_at) {
      await db.expenses.put(remote)
    }
    if (remote.updated_at > maxTs) maxTs = remote.updated_at
  }
  await metaSet(META.syncWatermark, maxTs)

  // Keep the trip row (percentage, home currency) fresh too.
  const tripId = await metaGet<string>(META.activeTripId)
  if (tripId) {
    const { data: trip } = await sb.from('trips').select('*').eq('id', tripId).single()
    if (trip) await db.trip.put(trip as Trip)
  }
}

function toRow(e: Expense): Record<string, unknown> {
  return { ...e }
}

function fromRow(row: Record<string, unknown>): Expense {
  return row as unknown as Expense
}

export function getSyncState(): SyncState {
  return state
}
