import { useSyncState } from '../hooks/useSyncState'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useSession } from './SessionProvider'

export function SyncBadge() {
  const online = useOnlineStatus()
  const { status, pending } = useSyncState()
  const { localOnly } = useSession()

  let label = 'Synced'
  let color = 'bg-success-bg text-success-text'

  if (localOnly) {
    label = 'On this device'
    color = 'bg-surface text-steel'
  } else if (!online) {
    label = pending ? `Offline · ${pending} to sync` : 'Offline'
    color = 'bg-surface text-charcoal'
  } else if (status === 'syncing') {
    label = 'Syncing…'
    color = 'bg-surface text-charcoal'
  } else if (status === 'error') {
    label = 'Sync error'
    color = 'bg-danger/10 text-danger'
  } else if (pending) {
    label = `${pending} to sync`
    color = 'bg-surface text-charcoal'
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold ${color}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}
