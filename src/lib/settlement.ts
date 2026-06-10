import { convert } from './fx'
import { CURRENCIES, type Currency, type Expense, type RateCache } from './types'

export interface Settlement {
  /** What you owe her, expressed in every currency. */
  owed: Record<Currency, number>
  /** Wife's included spend, per display currency. */
  wifeTotal: Record<Currency, number>
  /** Your own included spend (informational — never subtracted from owed). */
  myTotal: Record<Currency, number>
  /** Wife's spend split for her bookkeeping (in the home currency). */
  wifeBusiness: number
  wifePersonal: number
  /** Count of active expenses that fed the calculation. */
  activeCount: number
}

function zero(): Record<Currency, number> {
  return { EUR: 0, GBP: 0, AUD: 0 }
}

/**
 * The single source of truth for "what I owe her".
 *
 *   owed = percentage% × (sum of wife's ACTIVE spend)
 *
 * Inactive (toggled-off) and deleted expenses are skipped entirely. Your own
 * spend is reported but never reduces what you owe.
 */
export function computeSettlement(
  expenses: Expense[],
  percentage: number,
  rates: RateCache,
  homeCurrency: Currency,
): Settlement {
  const wifeTotal = zero()
  const myTotal = zero()
  let wifeBusiness = 0
  let wifePersonal = 0
  let activeCount = 0

  for (const e of expenses) {
    if (e.deleted || !e.is_active) continue
    activeCount++
    const target = e.paid_by === 'wife' ? wifeTotal : myTotal
    for (const c of CURRENCIES) {
      target[c] += convert(e.amount, e.currency, c, rates)
    }
    if (e.paid_by === 'wife') {
      const inHome = convert(e.amount, e.currency, homeCurrency, rates)
      if (e.is_business) wifeBusiness += inHome
      else wifePersonal += inHome
    }
  }

  const factor = percentage / 100
  const owed = zero()
  for (const c of CURRENCIES) owed[c] = wifeTotal[c] * factor

  return { owed, wifeTotal, myTotal, wifeBusiness, wifePersonal, activeCount }
}
