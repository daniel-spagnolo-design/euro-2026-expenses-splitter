import { META, metaGet, metaSet } from './db'
import { CURRENCIES, type Currency, type RateCache } from './types'

/** Sensible fallback so the very first offline launch still converts roughly. */
const FALLBACK: RateCache = {
  base: 'EUR',
  rates: { EUR: 1, GBP: 0.85, AUD: 1.62 },
  fetched_at: '1970-01-01T00:00:00.000Z',
  manual: false,
}

export async function getRates(): Promise<RateCache> {
  return (await metaGet<RateCache>(META.rates)) ?? FALLBACK
}

/** Fetch fresh ECB rates from Frankfurter. Skips overwriting manual overrides. */
export async function refreshRates(force = false): Promise<RateCache> {
  const current = await getRates()
  if (current.manual && !force) return current

  const to = CURRENCIES.filter((c) => c !== 'EUR').join(',')
  const res = await fetch(`https://api.frankfurter.app/latest?from=EUR&to=${to}`)
  if (!res.ok) throw new Error(`FX fetch failed: ${res.status}`)
  const data = (await res.json()) as { rates: Record<string, number> }

  const rates = { EUR: 1 } as Record<Currency, number>
  for (const c of CURRENCIES) {
    if (c === 'EUR') continue
    if (typeof data.rates[c] !== 'number') throw new Error(`Missing rate for ${c}`)
    rates[c] = data.rates[c]
  }

  const next: RateCache = {
    base: 'EUR',
    rates,
    fetched_at: new Date().toISOString(),
    manual: false,
  }
  await metaSet(META.rates, next)
  return next
}

/** Persist user-entered rates (units per 1 EUR) and mark them as manual. */
export async function setManualRates(rates: Record<Currency, number>): Promise<RateCache> {
  const next: RateCache = {
    base: 'EUR',
    rates: { ...rates, EUR: 1 },
    fetched_at: new Date().toISOString(),
    manual: true,
  }
  await metaSet(META.rates, next)
  return next
}

/** Drop manual override and go back to auto-fetched rates on next refresh. */
export async function clearManualRates(): Promise<void> {
  const current = await getRates()
  await metaSet(META.rates, { ...current, manual: false })
}

/** Convert via EUR. rates are units of <currency> per 1 EUR. */
export function convert(
  amount: number,
  from: Currency,
  to: Currency,
  rates: RateCache,
): number {
  if (from === to) return amount
  const inEur = amount / rates.rates[from]
  return inEur * rates.rates[to]
}
