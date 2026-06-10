import type { PaidBy } from './types'

/**
 * Display names for the two people on the trip. `me` is the person who owes a
 * share (Daniel); `wife` is the person whose spend that share is based on (Jay).
 * Kept in one place so they're easy to change (or wire to Settings later).
 */
export const PEOPLE: Record<PaidBy, string> = {
  me: 'Daniel',
  wife: 'Jay',
}

export const nameFor = (p: PaidBy): string => PEOPLE[p]
