import type { EmailOtpType } from '@supabase/supabase-js'
import { db, META, metaSet } from './db'
import { getSupabase } from './supabase'
import { sync } from './sync'
import type { Trip } from './types'

function genJoinCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

/**
 * Email the user a 6-digit sign-in code.
 *
 * We deliberately do NOT pass `emailRedirectTo`: a clickable link opens in the
 * default browser, which on iOS is a separate storage context from the
 * installed standalone PWA — so the session would land in Safari and never
 * reach the app the user signed in from. Sending a code the user types back
 * into the app creates the session in the same context. (`shouldCreateUser`
 * defaults to true, so first-time users are created.)
 */
export async function sendLoginCode(email: string): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  const { error } = await sb.auth.signInWithOtp({ email })
  if (error) throw error
}

/**
 * Finish signing in from whatever the email contained. On iOS an installed
 * standalone PWA has its own storage, separate from Safari, and email links
 * always open in Safari — so the session can never arrive by *clicking* the
 * link. Instead the user pastes the sign-in link (or types a code) back into
 * the app, and we verify it here so the session is created in THIS context.
 *
 * Accepts either:
 *   - the full sign-in link (we extract its token_hash + type), or
 *   - a typed 6-digit code (only present if custom SMTP shows {{ .Token }}).
 */
export async function verifyLogin(email: string, input: string): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  const raw = input.trim()
  if (!raw) throw new Error('Paste the sign-in link from your email')

  const link = extractTokenFromLink(raw)
  if (link) {
    const { error } = await sb.auth.verifyOtp({ token_hash: link.token, type: link.type })
    if (error) throw error
    return
  }

  // Fall back to a typed code (requires the email to show {{ .Token }}).
  const { error } = await sb.auth.verifyOtp({ email, token: raw, type: 'email' })
  if (error) throw error
}

/**
 * Pull the token_hash + type out of a pasted Supabase sign-in link. Tolerant of
 * email-provider link wrappers (e.g. Yahoo's deref redirect) that percent-encode
 * the real URL: we decode a few times, then regex-match the token directly.
 */
function extractTokenFromLink(value: string): { token: string; type: EmailOtpType } | null {
  if (!/https?:\/\//i.test(value)) return null
  let s = value
  for (let i = 0; i < 3; i++) {
    try {
      const decoded = decodeURIComponent(s)
      if (decoded === s) break
      s = decoded
    } catch {
      break
    }
  }
  const token = s.match(/[?&](?:token_hash|token)=([^&\s]+)/i)?.[1]
  const type = (s.match(/[?&]type=([^&\s]+)/i)?.[1] ?? 'magiclink') as EmailOtpType
  return token ? { token, type } : null
}

export async function signOut(): Promise<void> {
  const sb = getSupabase()
  if (sb) await sb.auth.signOut()
  await db.delete()
  location.reload()
}

/** Create a brand-new shared trip and make the caller a member. */
export async function createTrip(name: string, displayName: string): Promise<Trip> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) throw new Error('Not signed in')

  const trip: Omit<Trip, 'created_at'> = {
    id: crypto.randomUUID(),
    name: name.trim() || 'Our trip',
    owe_percentage: 25,
    home_currency: 'AUD',
    join_code: genJoinCode(),
  }

  // No .select() here: reading the row back would apply the SELECT policy
  // (is_trip_member) before our membership row exists, which Postgres reports
  // as a 42501 "new row violates row-level security policy". We generated the
  // row locally, so we don't need it returned.
  const { error } = await sb.from('trips').insert(trip)
  if (error) throw error

  const { error: memErr } = await sb.from('trip_members').insert({
    trip_id: trip.id,
    user_id: auth.user.id,
    display_name: displayName,
  })
  if (memErr) throw memErr

  const fullTrip: Trip = { ...trip, created_at: new Date().toISOString() }
  await adoptTrip(fullTrip)
  return fullTrip
}

/** Join an existing trip via its 6-char code. */
export async function joinTrip(code: string, displayName: string): Promise<Trip> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) throw new Error('Not signed in')

  // SECURITY DEFINER RPC looks up the trip by code and adds us as a member,
  // so the trips table stays invisible to non-members.
  const { data: trip, error } = await sb.rpc('join_trip', {
    p_code: code.trim().toUpperCase(),
    p_display_name: displayName,
  })
  if (error || !trip) throw new Error(error?.message ?? 'No trip found for that code')

  await adoptTrip(trip as Trip)
  return trip as Trip
}

/** Store the trip locally and kick off the first sync. */
async function adoptTrip(trip: Trip): Promise<void> {
  await db.trip.put(trip)
  await metaSet(META.activeTripId, trip.id)
  await sync()
}

/** Create a device-only trip so the app is usable before Supabase is wired. */
export async function createLocalTrip(): Promise<Trip> {
  const trip: Trip = {
    id: crypto.randomUUID(),
    name: 'Our trip',
    owe_percentage: 25,
    home_currency: 'AUD',
    join_code: genJoinCode(),
    created_at: new Date().toISOString(),
  }
  await db.trip.put(trip)
  await metaSet(META.activeTripId, trip.id)
  return trip
}

/** On app load: if signed in and a member of a trip, hydrate it. */
export async function restoreSession(): Promise<Trip | null> {
  const sb = getSupabase()
  if (!sb) return null
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) return null

  const { data: member } = await sb
    .from('trip_members')
    .select('trip_id, trips(*)')
    .limit(1)
    .maybeSingle()

  const trip = (member?.trips as Trip | undefined) ?? null
  if (trip) await adoptTrip(trip)
  return trip
}
