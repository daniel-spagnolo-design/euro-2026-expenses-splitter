import { NavLink, Route, Routes } from 'react-router-dom'
import { SessionProvider, useSession } from './components/SessionProvider'
import { Onboarding } from './screens/Onboarding'
import { Dashboard } from './screens/Dashboard'
import { AddExpense } from './screens/AddExpense'
import { ExpensesList } from './screens/ExpensesList'
import { Settings } from './screens/Settings'

export default function App() {
  return (
    <SessionProvider>
      <Gate />
    </SessionProvider>
  )
}

function Gate() {
  const { phase } = useSession()

  if (phase === 'loading') {
    return <div className="flex h-full items-center justify-center text-steel">Loading…</div>
  }
  if (phase !== 'ready') {
    return <Onboarding />
  }

  return (
    <div className="flex h-full flex-col bg-canvas">
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/add" element={<AddExpense />} />
          <Route path="/expenses" element={<ExpensesList />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}

function NavIcon({ kind, active }: { kind: string; active: boolean }) {
  const stroke = active ? '#1a1a1a' : '#999999'
  const common = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (kind === 'home') return (<svg {...common}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /></svg>)
  if (kind === 'expenses') return (<svg {...common}><path d="M6 3h9l3 3v15l-2.2-1.3L13.6 21l-2.2-1.3L9.2 21 7 19.7 4 21V5a2 2 0 0 1 2-2Z" /><path d="M8 8h7M8 12h7M8 16h4" /></svg>)
  return (<svg {...common}><circle cx="12" cy="12" r="3.2" /><path d="M19.4 12a7.4 7.4 0 0 0-.12-1.3l1.9-1.5-1.9-3.3-2.3.9a7.3 7.3 0 0 0-2.2-1.3L14.4 2H9.6l-.4 2.4a7.3 7.3 0 0 0-2.2 1.3l-2.3-.9-1.9 3.3 1.9 1.5a7.4 7.4 0 0 0 0 2.6l-1.9 1.5 1.9 3.3 2.3-.9a7.3 7.3 0 0 0 2.2 1.3l.4 2.4h4.8l.4-2.4a7.3 7.3 0 0 0 2.2-1.3l2.3.9 1.9-3.3-1.9-1.5c.08-.43.12-.86.12-1.3Z" /></svg>)
}

function BottomNav() {
  const items = [
    { to: '/', label: 'Home', kind: 'home' },
    { to: '/expenses', label: 'Expenses', kind: 'expenses' },
    { to: '/settings', label: 'Settings', kind: 'settings' },
  ]

  return (
    <nav className="safe-bottom border-t border-hairline bg-canvas">
      <div className="mx-auto flex max-w-md items-center justify-around px-3 py-1.5">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-1.5 text-[11px] font-medium ${
                isActive ? 'text-ink' : 'text-stone'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <NavIcon kind={it.kind} active={isActive} />
                <span>{it.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
