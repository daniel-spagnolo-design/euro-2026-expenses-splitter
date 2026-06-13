import { useState } from 'react'
import { useSession } from '../components/SessionProvider'
import { createLocalTrip, createTrip, joinTrip, sendLoginCode, verifyLogin } from '../lib/session'

export function Onboarding() {
  const { phase, localOnly } = useSession()

  if (phase === 'need-auth' && !localOnly) return <AuthStep />
  return <TripStep />
}

function AuthStep() {
  const { refresh } = useSession()
  const [email, setEmail] = useState('')
  const [pasted, setPasted] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await sendLoginCode(email)
      setSent(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await verifyLogin(email, pasted)
      // Session is now stored in this context; advance the gate.
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell title="Sign in">
      {sent ? (
        <form onSubmit={verify} className="space-y-3">
          <p className="text-sm text-steel">
            We emailed <span className="font-semibold text-ink">{email}</span>. Open it, then
            <span className="font-semibold text-ink"> press and hold the “Sign in” link → Copy Link</span>,
            and paste it below. (Don’t tap the link — that opens the browser instead.)
          </p>
          <textarea
            required
            rows={3}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="Paste the sign-in link here"
            className={`${inputClass} resize-none break-all`}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <button disabled={busy || !pasted.trim()} className={primaryBtn}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <button
            type="button"
            onClick={() => { setSent(false); setPasted(''); setError(null) }}
            className="w-full text-sm text-steel underline"
          >
            Use a different email
          </button>
        </form>
      ) : (
        <form onSubmit={send} className="space-y-3">
          <p className="text-sm text-steel">
            We’ll email you a sign-in link — no password needed.
          </p>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputClass}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <button disabled={busy} className={primaryBtn}>
            {busy ? 'Sending…' : 'Email me a link'}
          </button>
        </form>
      )}
    </Shell>
  )
}

function TripStep() {
  const { localOnly, refresh } = useSession()
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('Our Euro trip')
  const [displayName, setDisplayName] = useState('me')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (localOnly) await createLocalTrip()
      else if (mode === 'create') await createTrip(name, displayName)
      else await joinTrip(code, displayName)
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell title="Set up your trip">
      {localOnly && (
        <p className="mb-3 rounded-lg bg-surface px-3 py-2 text-xs text-charcoal">
          Running on this device only. Add Supabase keys later to sync with another phone.
        </p>
      )}

      {!localOnly && (
        <div className="mb-4 flex gap-2 text-sm">
          <button
            onClick={() => setMode('create')}
            className={`flex-1 rounded-full py-2.5 font-semibold ${mode === 'create' ? 'bg-ink text-canvas' : 'border border-hairline text-steel'}`}
          >
            Start new
          </button>
          <button
            onClick={() => setMode('join')}
            className={`flex-1 rounded-full py-2.5 font-semibold ${mode === 'join' ? 'bg-ink text-canvas' : 'border border-hairline text-steel'}`}
          >
            Join with code
          </button>
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        {!localOnly && (
          <label className="block">
            <span className="text-xs font-medium text-steel">Your name</span>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} />
          </label>
        )}

        {mode === 'create' || localOnly ? (
          <label className="block">
            <span className="text-xs font-medium text-steel">Trip name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </label>
        ) : (
          <label className="block">
            <span className="text-xs font-medium text-steel">Join code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              className={`${inputClass} tracking-[0.3em] uppercase`}
            />
          </label>
        )}

        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button disabled={busy} className={primaryBtn}>
          {busy ? 'Working…' : localOnly ? 'Start tracking' : mode === 'create' ? 'Create trip' : 'Join trip'}
        </button>
      </form>
    </Shell>
  )
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="safe-top flex min-h-full flex-col justify-center bg-canvas px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-ink text-2xl text-canvas">
            €
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  )
}

const inputClass =
  'mt-1 w-full rounded-lg border border-hairline bg-canvas px-3 py-2.5 text-ink outline-none focus:border-2 focus:border-brandblue-deep'
const primaryBtn =
  'w-full rounded-full bg-ink py-3.5 font-semibold text-canvas disabled:opacity-40'
