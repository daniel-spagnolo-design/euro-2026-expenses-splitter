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
 * Email + password auth. Chosen over magic links because, on an installed iOS
 * PWA, email links open in Safari (a separate storage context) and never reach
 * the app, and webmail scanners (e.g. Yahoo) pre-open the link and burn the
 * one-time token. Password sign-in sends no email at all, so the session is
 * created directly in the app's own context.
 *
 * Requires "Confirm email" to be OFF in Supabase (Authentication → Providers →
 * Email); otherwise signUp emails a confirmation link instead of returning a
 * session — we surface that case with a clear message below.
 */
export async function signUpWithPassword(email: string, password: string): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  const { data, error } = await sb.auth.signUp({ email, password })
  if (error) throw error
  if (!data.session) {
    throw new Error(
      'Account created, but “Confirm email” is still on in Supabase. Turn it off ' +
        '(Authentication → Providers → Email), then sign in.',
    )
  }
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  const { error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw error
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
