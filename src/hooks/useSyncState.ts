import { useEffect, useState } from 'react'
import { subscribeSync, type SyncState } from '../lib/sync'

export function useSyncState(): SyncState {
  const [state, setState] = useState<SyncState>({
    status: 'idle',
    lastSyncedAt: null,
    pending: 0,
  })
  useEffect(() => subscribeSync(setState), [])
  return state
}
