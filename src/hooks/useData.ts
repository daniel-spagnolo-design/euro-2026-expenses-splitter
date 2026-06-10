import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../lib/db'
import { getRates } from '../lib/fx'
import type { Expense, RateCache, Trip } from '../lib/types'

/**
 * Live list of expenses (soft-deleted filtered out), newest first.
 * Dexie can't index boolean fields, so we read all and filter in memory —
 * fine for a two-person trip's worth of rows.
 */
export function useExpenseList(): Expense[] {
  const all = useLiveQuery(() => db.expenses.toArray(), []) ?? []
  return all
    .filter((e) => !e.deleted)
    .sort((a, b) => (a.spent_at < b.spent_at ? 1 : -1))
}

export function useTrip(): Trip | undefined {
  return useLiveQuery(() => db.trip.toCollection().first(), [])
}

export function useRates(): RateCache | undefined {
  const [rates, setRates] = useState<RateCache>()
  // Re-read whenever the rate cache row changes.
  const meta = useLiveQuery(() => db.meta.get('rates'), [])
  useEffect(() => {
    void getRates().then(setRates)
  }, [meta])
  return rates
}
