import { useEffect, useState } from 'react'
import { SyncBadge } from '../components/SyncBadge'
import { useSession } from '../components/SessionProvider'
import { useExpenseList, useRates, useTrip } from '../hooks/useData'
import { expensesToCsv, downloadCsv } from '../lib/csv'
import { clearManualRates, refreshRates, setManualRates } from '../lib/fx'
import { PEOPLE } from '../lib/people'
import { setHomeCurrency, setPercentage } from '../lib/repo'
import { signOut } from '../lib/session'
import { CURRENCIES, type Currency } from '../lib/types'

export function Settings() {
  const trip = useTrip()
  const rates = useRates()
  const expenses = useExpenseList()
  const { localOnly } = useSession()
  const [draftRates, setDraftRates] = useState<Record<Currency, string>>({ EUR: '1', GBP: '', AUD: '' })
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (rates) {
      setDraftRates({
        EUR: '1',
        GBP: String(rates.rates.GBP),
        AUD: String(rates.rates.AUD),
      })
    }
  }, [rates])

  if (!trip || !rates) return null

  async function doRefresh() {
    setRefreshing(true)
    try {
      await refreshRates(true)
    } finally {
      setRefreshing(false)
    }
  }

  async function saveManual() {
    await setManualRates({
      EUR: 1,
      GBP: parseFloat(draftRates.GBP) || rates!.rates.GBP,
      AUD: parseFloat(draftRates.AUD) || rates!.rates.AUD,
    })
  }

  return (
    <div className="safe-top mx-auto max-w-md px-4 pb-28 pt-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Settings</h1>
        <SyncBadge />
      </header>

      <Section title={`${PEOPLE.me}’s share`}>
        <Row label="Percentage of her spend">
          <input
            type="number"
            min={0}
            max={100}
            value={trip.owe_percentage}
            onChange={(e) => void setPercentage(trip.id, Number(e.target.value))}
            className={numInput}
          />
          <span className="text-steel">%</span>
        </Row>
        <Row label="Home currency">
          <select
            value={trip.home_currency}
            onChange={(e) => void setHomeCurrency(trip.id, e.target.value as Currency)}
            className="rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-ink outline-none"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Row>
      </Section>

      <Section title="Exchange rates" subtitle={`Units per €1 · updated ${new Date(rates.fetched_at).toLocaleString('en-AU')}${rates.manual ? ' · manual' : ''}`}>
        <Row label="£ GBP per €1">
          <input value={draftRates.GBP} onChange={(e) => setDraftRates({ ...draftRates, GBP: e.target.value })} className={numInput} />
        </Row>
        <Row label="A$ AUD per €1">
          <input value={draftRates.AUD} onChange={(e) => setDraftRates({ ...draftRates, AUD: e.target.value })} className={numInput} />
        </Row>
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={saveManual} className={smallBtn}>
            Save manual rates
          </button>
          {rates.manual && (
            <button onClick={() => void clearManualRates()} className={smallBtnGhost}>
              Use auto rates
            </button>
          )}
          <button onClick={doRefresh} disabled={refreshing} className={smallBtnGhost}>
            {refreshing ? 'Refreshing…' : 'Refresh now'}
          </button>
        </div>
      </Section>

      {!localOnly && (
        <Section title={`Share with ${PEOPLE.wife}`} subtitle="She enters this code on her phone to join">
          <div className="rounded-xl bg-surface py-4 text-center text-3xl font-semibold tracking-[0.3em] text-ink">
            {trip.join_code}
          </div>
        </Section>
      )}

      <Section title="Export">
        <button
          onClick={() => downloadCsv('expenses.csv', expensesToCsv(expenses))}
          className={smallBtn}
        >
          Download CSV (for her claims)
        </button>
      </Section>

      <button
        onClick={() => {
          if (confirm(localOnly ? 'Erase all local data?' : 'Sign out and clear this device?')) void signOut()
        }}
        className="mt-6 w-full rounded-full border border-danger/40 py-3 font-semibold text-danger"
      >
        {localOnly ? 'Erase all data' : 'Sign out'}
      </button>
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl border border-hairline bg-canvas p-4 shadow-subtle">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {subtitle && <p className="mb-2 mt-0.5 text-xs text-stone">{subtitle}</p>}
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-charcoal">{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  )
}

const numInput = 'w-20 rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-right text-ink outline-none'
const smallBtn = 'rounded-full bg-ink px-4 py-2 text-sm font-semibold text-canvas'
const smallBtnGhost = 'rounded-full border border-hairline px-4 py-2 text-sm font-medium text-charcoal'
