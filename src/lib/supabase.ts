import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

let client: SupabaseClient | null = null

/**
 * Returns the Supabase client, or null when env vars are missing. The app is
 * fully usable offline/local-only without Supabase; sync simply no-ops.
 */
export function getSupabase(): SupabaseClient | null {
  if (client) return client
  if (!url || !anon) return null
  client = createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  if (import.meta.env.DEV) (window as unknown as { sb: SupabaseClient }).sb = client
  return client
}

export const RECEIPTS_BUCKET = 'receipts'
