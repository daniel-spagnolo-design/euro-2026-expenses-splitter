import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { db } from '../lib/db'
import { refreshRates } from '../lib/fx'
import { getSupabase } from '../lib/supabase'
import { restoreSession } from '../lib/session'
import { sync } from '../lib/sync'
import type { Trip } from '../lib/types'

type Phase = 'loading' | 'need-auth' | 'need-trip' | 'ready'

interface SessionCtx {
  phase: Phase
  trip: Trip | null
  /** True when running without a Supabase backend (no cross-device sync). */
  localOnly: boolean
  refresh: () => Promise<void>
}

const Ctx = createContext<SessionCtx>({
  phase: 'loading',
  trip: null,
  localOnly: false,
  refresh: async () => {},
})

export const useSession = () => useContext(Ctx)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [trip, setTrip] = useState<Trip | null>(null)
  const sb = getSupabase()
  const localOnly = !sb

  async function bootstrap() {
    const localTrip = (await db.trip.toCollection().first()) ?? null

    // No backend configured → device-only mode.
    if (!sb) {
      setTrip(localTrip)
      setPhase(localTrip ? 'ready' : 'need-trip')
      return
    }

    const { data: auth } = await sb.auth.getUser()
    if (!auth.user) {
      setPhase('need-auth')
      return
    }

    const remoteTrip = await restoreSession()
    const resolved = remoteTrip ?? localTrip
    setTrip(resolved)
    setPhase(resolved ? 'ready' : 'need-trip')
  }

  useEffect(() => {
    void bootstrap()
    // React to magic-link return / sign-out.
    const sub = sb?.auth.onAuthStateChange(() => void bootstrap())
    // Best-effort rate refresh + initial sync on launch.
    void refreshRates().catch(() => {})
    void sync()
    return () => sub?.data.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refresh = async () => {
    await bootstrap()
  }

  return (
    <Ctx.Provider value={{ phase, trip, localOnly, refresh }}>{children}</Ctx.Provider>
  )
}
