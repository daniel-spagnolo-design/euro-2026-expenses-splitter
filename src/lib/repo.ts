import { db } from './db'
import { getSupabase } from './supabase'
import { scheduleSync } from './sync'
import type { Currency, Expense, PaidBy, Trip } from './types'

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export interface NewExpenseInput {
  amount: number
  currency: Currency
  paid_by: PaidBy
  is_business: boolean
  note: string
  spent_at: string
  receiptBlob?: Blob | null
}

/** Create an expense locally, queue any photo, and schedule a sync. */
export async function addExpense(tripId: string, input: NewExpenseInput): Promise<Expense> {
  const now = new Date().toISOString()
  const expense: Expense = {
    id: uuid(),
    trip_id: tripId,
    amount: input.amount,
    currency: input.currency,
    paid_by: input.paid_by,
    is_business: input.is_business,
    note: input.note.trim(),
    receipt_path: null,
    spent_at: input.spent_at,
    is_active: true,
    updated_at: now,
    deleted: false,
  }

  await db.transaction('rw', db.expenses, db.receipts, db.outbox, async () => {
    await db.expenses.put(expense)
    if (input.receiptBlob) {
      await db.receipts.put({
        expense_id: expense.id,
        blob: input.receiptBlob,
        content_type: input.receiptBlob.type || 'image/jpeg',
      })
    }
    await db.outbox.add({ op: 'upsert', expense_id: expense.id, queued_at: now })
  })

  scheduleSync()
  return expense
}

export async function updateExpense(
  id: string,
  patch: Partial<Omit<Expense, 'id' | 'trip_id'>>,
): Promise<void> {
  const now = new Date().toISOString()
  await db.transaction('rw', db.expenses, db.outbox, async () => {
    const existing = await db.expenses.get(id)
    if (!existing) return
    await db.expenses.put({ ...existing, ...patch, updated_at: now })
    await db.outbox.add({ op: 'upsert', expense_id: id, queued_at: now })
  })
  scheduleSync()
}

/** The include/exclude toggle — never deletes, just flips is_active. */
export async function toggleActive(id: string): Promise<void> {
  const existing = await db.expenses.get(id)
  if (!existing) return
  await updateExpense(id, { is_active: !existing.is_active })
}

/** Soft-delete so the removal also propagates to the other phone. */
export async function deleteExpense(id: string): Promise<void> {
  await updateExpense(id, { deleted: true })
}

// --- trip / settings ------------------------------------------------------

export async function getTrip(): Promise<Trip | undefined> {
  return (await db.trip.toCollection().first()) ?? undefined
}

export async function saveTripLocal(trip: Trip): Promise<void> {
  await db.trip.put(trip)
}

export async function setPercentage(tripId: string, pct: number): Promise<void> {
  const trip = await db.trip.get(tripId)
  if (!trip) return
  const next = { ...trip, owe_percentage: pct }
  await db.trip.put(next)
  await pushTripSetting(tripId, { owe_percentage: pct })
}

export async function setHomeCurrency(tripId: string, currency: Currency): Promise<void> {
  const trip = await db.trip.get(tripId)
  if (!trip) return
  await db.trip.put({ ...trip, home_currency: currency })
  await pushTripSetting(tripId, { home_currency: currency })
}

// Trip settings are tiny and rarely conflict, so we push them best-effort
// directly; sync.ts also re-pulls the trip row on every sync.
async function pushTripSetting(tripId: string, patch: Partial<Trip>): Promise<void> {
  try {
    const sb = getSupabase()
    if (sb) await sb.from('trips').update(patch).eq('id', tripId)
  } catch {
    // Offline or not signed in — the local value still stands and the next
    // full sync will reconcile.
  }
}
