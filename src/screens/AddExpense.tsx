import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ReceiptCapture } from '../components/ReceiptCapture'
import { useTrip } from '../hooks/useData'
import { formatDateTimeLocal } from '../lib/format'
import { PEOPLE } from '../lib/people'
import { addExpense } from '../lib/repo'
import { CURRENCIES, CURRENCY_SYMBOL, type Currency, type PaidBy } from '../lib/types'

export function AddExpense() {
  const trip = useTrip()
  const navigate = useNavigate()

  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>('EUR')
  const [paidBy, setPaidBy] = useState<PaidBy>('wife')
  const [isBusiness, setIsBusiness] = useState(true)
  const [note, setNote] = useState('')
  const [spentAt, setSpentAt] = useState(formatDateTimeLocal(new Date().toISOString()))
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [busy, setBusy] = useState(false)

  if (!trip) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const value = parseFloat(amount)
    if (!Number.isFinite(value) || value <= 0) return
    setBusy(true)
    await addExpense(trip!.id, {
      amount: value,
      currency,
      paid_by: paidBy,
      is_business: isBusiness,
      note,
      spent_at: new Date(spentAt).toISOString(),
      receiptBlob: photo,
    })
    navigate('/')
  }

  return (
    <div className="safe-top mx-auto max-w-md bg-canvas px-4 pb-28 pt-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Add expense</h1>
        <button onClick={() => navigate(-1)} className="text-sm font-medium text-steel">
          Cancel
        </button>
      </header>

      <form onSubmit={submit} className="space-y-4">
        <ReceiptCapture
          onPhoto={setPhoto}
          onReading={(r) => {
            if (r.amount != null) setAmount(String(r.amount))
            if (r.currency) setCurrency(r.currency)
          }}
        />

        {/* Amount + currency */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className={labelClass}>Amount</label>
            <div className="mt-1 flex items-center rounded-lg border border-hairline bg-canvas px-3">
              <span className="text-steel">{CURRENCY_SYMBOL[currency]}</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent px-2 py-2.5 text-lg text-ink outline-none"
                autoFocus
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="mt-1 rounded-lg border border-hairline bg-canvas px-3 py-2.5 text-ink outline-none"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Paid by */}
        <Segmented<PaidBy>
          label="Paid by"
          value={paidBy}
          onChange={setPaidBy}
          options={[
            { value: 'wife', label: PEOPLE.wife },
            { value: 'me', label: PEOPLE.me },
          ]}
        />

        {/* Business / personal */}
        <Segmented<boolean>
          label="Type"
          value={isBusiness}
          onChange={setIsBusiness}
          options={[
            { value: true, label: 'Business' },
            { value: false, label: 'Personal' },
          ]}
        />

        <label className="block">
          <span className={labelClass}>Note (optional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Hotel, dinner, train"
            className="mt-1 w-full rounded-lg border border-hairline bg-canvas px-3 py-2.5 text-ink outline-none placeholder:text-stone"
          />
        </label>

        <label className="block">
          <span className={labelClass}>When</span>
          <input
            type="datetime-local"
            value={spentAt}
            onChange={(e) => setSpentAt(e.target.value)}
            className="mt-1 w-full rounded-lg border border-hairline bg-canvas px-3 py-2.5 text-ink outline-none"
          />
        </label>

        <button
          disabled={busy || !amount}
          className="w-full rounded-full bg-ink py-3.5 font-semibold text-canvas disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save expense'}
        </button>
      </form>
    </div>
  )
}

function Segmented<T extends string | boolean>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div>
      <span className={labelClass}>{label}</span>
      <div className="mt-1 flex gap-2">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-full py-2.5 text-sm font-semibold ${
              o.value === value ? 'bg-ink text-canvas' : 'border border-hairline text-steel'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const labelClass = 'text-xs font-medium text-steel'
