import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AddButton } from '../components/AddButton'
import { SyncBadge } from '../components/SyncBadge'
import { useExpenseList, useRates, useTrip } from '../hooks/useData'
import { formatMoney } from '../lib/format'
import { PEOPLE } from '../lib/people'
import { setPercentage } from '../lib/repo'
import { computeSettlement } from '../lib/settlement'
import { type Currency } from '../lib/types'

// Pills show the currency code + a plain symbol, home currency first.
const PILL_ORDER: Currency[] = ['AUD', 'GBP', 'EUR']
const PLAIN: Record<Currency, string> = { EUR: '€', GBP: '£', AUD: '$' }
const fmtNum = (n: number) =>
  n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function Dashboard() {
  const trip = useTrip()
  const expenses = useExpenseList()
  const rates = useRates()
  const [headline, setHeadline] = useState<Currency>('AUD')

  const settlement = useMemo(() => {
    if (!trip || !rates) return null
    return computeSettlement(expenses, trip.owe_percentage, rates, trip.home_currency)
  }, [expenses, trip, rates])

  if (!trip || !rates || !settlement) {
    return <div className="p-6 text-steel">Loading…</div>
  }

  return (
    <div className="safe-top mx-auto max-w-md bg-canvas px-4 pb-28 pt-4">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{trip.name}</h1>
          <p className="text-sm text-steel">What you owe your wife</p>
        </div>
        <SyncBadge />
      </header>

      {/* Owed card — vibrant gradient product moment */}
      <section className="rounded-hero bg-gradient-to-br from-coral to-magenta p-6 text-canvas shadow-card">
        <p className="text-sm font-medium text-canvas/80">{PEOPLE.me} owes</p>
        <p className="mt-1 text-[44px] font-semibold leading-none tracking-tight">
          {formatMoney(settlement.owed[headline], headline)}
        </p>
        <div className="mt-4 flex gap-2">
          {PILL_ORDER.map((c) => (
            <button
              key={c}
              onClick={() => setHeadline(c)}
              className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${
                c === headline ? 'bg-canvas text-ink' : 'bg-canvas/20 text-canvas'
              }`}
            >
              {c} {PLAIN[c]}
              {fmtNum(settlement.owed[c])}
            </button>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-canvas/80">
          = {trip.owe_percentage}% of her {formatMoney(settlement.wifeTotal[headline], headline)} spend
        </p>
      </section>

      <PercentageControl value={trip.owe_percentage} onChange={(p) => void setPercentage(trip.id, p)} />

      {/* Breakdown */}
      <section className="mt-3 grid grid-cols-2 items-start gap-3">
        <div className="rounded-2xl border border-hairline bg-canvas p-4 shadow-subtle">
          <p className="text-[13px] text-steel">{PEOPLE.wife}’s spend</p>
          <p className="mt-1 text-xl font-semibold tracking-tight text-ink">
            {formatMoney(settlement.wifeTotal[headline], headline)}
          </p>
          <div className="mt-2 space-y-0.5 border-t border-hairline pt-2 text-[11px] text-steel">
            <p>Business: {formatMoney(settlement.wifeBusiness, trip.home_currency)}</p>
            <p>Personal: {formatMoney(settlement.wifePersonal, trip.home_currency)}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-hairline bg-canvas p-4 shadow-subtle">
          <p className="text-[13px] text-steel">
            {PEOPLE.me}’s spend <span className="text-stone">(not owed)</span>
          </p>
          <p className="mt-1 text-xl font-semibold tracking-tight text-ink">
            {formatMoney(settlement.myTotal[headline], headline)}
          </p>
        </div>
      </section>

      {settlement.activeCount === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-hairline p-6 text-center text-steel">
          <p className="text-sm">No expenses yet.</p>
          <Link to="/add" className="mt-3 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-canvas">
            Add your first
          </Link>
        </div>
      )}

      <AddButton />
    </div>
  )
}

function PercentageControl({ value, onChange }: { value: number; onChange: (p: number) => void }) {
  return (
    <section className="mt-3 rounded-2xl border border-hairline bg-canvas p-4 shadow-subtle">
      <div className="flex items-center justify-between">
        <span className="text-sm text-charcoal">Your share of her spend</span>
        <span className="text-xl font-semibold text-ink">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full accent-ink"
      />
    </section>
  )
}
