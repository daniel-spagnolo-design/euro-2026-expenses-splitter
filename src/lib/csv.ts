import { formatDate } from './format'
import type { Expense } from './types'

/** Build a CSV of (optionally filtered) expenses for bookkeeping/claims. */
export function expensesToCsv(expenses: Expense[]): string {
  const header = ['Date', 'Amount', 'Currency', 'Paid by', 'Type', 'Active', 'Note']
  const rows = expenses
    .filter((e) => !e.deleted)
    .map((e) => [
      formatDate(e.spent_at),
      e.amount.toFixed(2),
      e.currency,
      e.paid_by,
      e.is_business ? 'Business' : 'Personal',
      e.is_active ? 'yes' : 'no',
      e.note.replace(/"/g, '""'),
    ])
  return [header, ...rows]
    .map((cols) => cols.map((c) => `"${c}"`).join(','))
    .join('\n')
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
