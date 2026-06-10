import { useMemo, useState } from 'react'
import { AddButton } from '../components/AddButton'
import { useReceiptUrl } from '../components/ReceiptThumb'
import { useExpenseList } from '../hooks/useData'
import { formatDate, formatMoney } from '../lib/format'
import { PEOPLE } from '../lib/people'
import { deleteExpense, toggleActive, updateExpense } from '../lib/repo'
import { CURRENCY_SYMBOL, type Expense, type PaidBy } from '../lib/types'

type Filter = 'all' | 'wife' | 'me' | 'inactive'

export function ExpensesList() {
  const expenses = useExpenseList()
  const [filter, setFilter] = useState<Filter>('all')

  const shown = useMemo(() => {
    switch (filter) {
      case 'wife':
        return expenses.filter((e) => e.paid_by === 'wife')
      case 'me':
        return expenses.filter((e) => e.paid_by === 'me')
      case 'inactive':
        return expenses.filter((e) => !e.is_active)
      default:
        return expenses
    }
  }, [expenses, filter])

  return (
    <div className="safe-top mx-auto max-w-md bg-canvas px-4 pb-28 pt-4">
      <h1 className="mb-3 text-2xl font-semibold tracking-tight text-ink">Expenses</h1>

      <div className="mb-3 flex gap-2 overflow-x-auto text-sm">
        {(['all', 'wife', 'me', 'inactive'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 font-semibold ${
              filter === f ? 'bg-ink text-canvas' : 'border border-hairline text-steel'
            }`}
          >
            {f === 'all' ? 'All' : f === 'wife' ? PEOPLE.wife : f === 'me' ? PEOPLE.me : 'Switched off'}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="mt-10 text-center text-sm text-stone">Nothing here yet.</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((e) => (
            <ExpenseRow key={e.id} expense={e} />
          ))}
        </ul>
      )}

      <AddButton />
    </div>
  )
}

function ExpenseRow({ expense }: { expense: Expense }) {
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const inactive = !expense.is_active

  async function remove() {
    if (confirm('Delete this expense?')) await deleteExpense(expense.id)
  }

  return (
    <li className={`rounded-2xl border border-hairline bg-canvas p-3 shadow-subtle ${inactive ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-3">
        <Thumb expense={expense} />

        {/* Flexible content — constrained so it never pushes the controls */}
        <button onClick={() => setOpen((o) => !o)} className="min-w-0 flex-1 text-left">
          {expense.note && (
            <p className={`truncate text-[13px] text-steel ${inactive ? 'line-through' : ''}`}>
              {expense.note}
            </p>
          )}
          <div className="flex items-baseline justify-between gap-2">
            <span className={`text-[17px] font-semibold text-ink ${inactive ? 'line-through' : ''}`}>
              {formatMoney(expense.amount, expense.currency)}
            </span>
            <span className="shrink-0 text-xs text-steel">{formatDate(expense.spent_at)}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-charcoal">
              {expense.paid_by === 'wife' ? PEOPLE.wife : PEOPLE.me}
            </span>
            <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-charcoal">
              {expense.is_business ? 'Business' : 'Personal'}
            </span>
          </div>
        </button>

        {/* Fixed controls — pinned top-right, never shift with content */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => void toggleActive(expense.id)}
            aria-label={inactive ? 'Switch on' : 'Switch off'}
            className={`relative h-6 w-11 rounded-full transition ${inactive ? 'bg-stone' : 'bg-ink'}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-canvas transition ${
                inactive ? 'left-0.5' : 'left-[22px]'
              }`}
            />
          </button>

          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="More options"
              className="flex h-8 w-8 items-center justify-center rounded-full text-steel active:bg-surface"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="12" cy="19" r="1.8" />
              </svg>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-xl border border-hairline bg-canvas shadow-card">
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      setOpen(true)
                    }}
                    className="block w-full px-4 py-2.5 text-left text-sm text-ink active:bg-surface"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      void toggleActive(expense.id)
                    }}
                    className="block w-full px-4 py-2.5 text-left text-sm text-ink active:bg-surface"
                  >
                    {inactive ? 'Switch on' : 'Switch off'}
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      void remove()
                    }}
                    className="block w-full border-t border-hairline px-4 py-2.5 text-left text-sm font-medium text-danger active:bg-surface"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {open && <EditPanel expense={expense} onDone={() => setOpen(false)} />}
    </li>
  )
}

/** Receipt thumbnail with a neutral placeholder when there's no photo. */
function Thumb({ expense }: { expense: Expense }) {
  const url = useReceiptUrl(expense)
  return url ? (
    <img src={url} alt="receipt" className="h-12 w-12 shrink-0 self-center rounded-xl object-cover" />
  ) : (
    <div className="h-12 w-12 shrink-0 self-center rounded-xl bg-surface" />
  )
}

function EditPanel({ expense, onDone }: { expense: Expense; onDone: () => void }) {
  const [amount, setAmount] = useState(String(expense.amount))
  const [note, setNote] = useState(expense.note)
  const [paidBy, setPaidBy] = useState<PaidBy>(expense.paid_by)
  const [isBusiness, setIsBusiness] = useState(expense.is_business)

  async function save() {
    const value = parseFloat(amount)
    await updateExpense(expense.id, {
      amount: Number.isFinite(value) ? value : expense.amount,
      note: note.trim(),
      paid_by: paidBy,
      is_business: isBusiness,
    })
    onDone()
  }

  async function remove() {
    if (confirm('Delete this expense?')) {
      await deleteExpense(expense.id)
      onDone()
    }
  }

  return (
    <div className="mt-3 space-y-2 border-t border-hairline pt-3">
      <div className="flex items-center gap-2">
        <span className="text-steel">{CURRENCY_SYMBOL[expense.currency]}</span>
        <input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-28 rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-ink outline-none"
        />
        <select
          value={paidBy}
          onChange={(e) => setPaidBy(e.target.value as PaidBy)}
          className="rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-ink outline-none"
        >
          <option value="wife">{PEOPLE.wife}</option>
          <option value="me">{PEOPLE.me}</option>
        </select>
        <label className="flex items-center gap-1 text-xs text-charcoal">
          <input type="checkbox" checked={isBusiness} onChange={(e) => setIsBusiness(e.target.checked)} className="accent-ink" />
          Business
        </label>
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note"
        className="w-full rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-ink outline-none placeholder:text-stone"
      />
      <div className="flex justify-between">
        <button onClick={remove} className="text-sm font-medium text-danger">
          Delete
        </button>
        <div className="flex gap-2">
          <button onClick={onDone} className="rounded-full px-3 py-1.5 text-sm font-medium text-steel">
            Cancel
          </button>
          <button onClick={save} className="rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-canvas">
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
