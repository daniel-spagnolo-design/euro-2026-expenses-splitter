// Reads a receipt photo and returns { amount, currency } using Claude vision.
// Deploy:  supabase functions deploy read-receipt --no-verify-jwt
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// Deployed with --no-verify-jwt because the gateway's JWT check rejects this
// project's (new signing-key) tokens. We gate the function ourselves by
// inspecting the caller's Supabase JWT locally (see isAuthed). We deliberately
// do NOT call GoTrue with SUPABASE_ANON_KEY: on projects switched to the new
// sb_publishable_/sb_secret_ key system the legacy anon key is often disabled,
// which made that round-trip fail for everyone.

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
// The app's publishable key, sent by supabase-js on every request as `apikey`.
// It's already public (ships in the browser bundle); we use it only to keep
// random callers off this Anthropic-billing endpoint.
const APP_PUBLISHABLE_KEY = Deno.env.get('APP_PUBLISHABLE_KEY')
const MODEL = 'claude-haiku-4-5-20251001'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

/** Decode a JWT payload without verifying its signature. */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=')
    return JSON.parse(atob(b64))
  } catch {
    return null
  }
}

/**
 * Gate the function to callers of this app. supabase-js attaches the bearer
 * token differently depending on auth state: a real "authenticated" user JWT
 * when signed in, but a fall back to the publishable key (NOT a JWT) when there
 * is no session (e.g. local-only mode). We accept either:
 *   1. a valid, unexpired Supabase "authenticated" JWT, OR
 *   2. the app's known publishable key (sent as `apikey` and/or bearer).
 * This isn't cryptographic security, but combined with the obscure function URL
 * it's the right bar for a private two-person app — the function only calls
 * Anthropic and touches no user data.
 */
function isAuthed(req: Request): boolean {
  // 1. Matching publishable key on either header — always present from the app.
  if (APP_PUBLISHABLE_KEY) {
    const apikey = req.headers.get('apikey')
    const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
    if (apikey === APP_PUBLISHABLE_KEY || bearer === APP_PUBLISHABLE_KEY) return true
  }
  // 2. A valid signed-in user JWT.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  const payload = token ? decodeJwtPayload(token) : null
  if (!payload) return false
  const exp = typeof payload.exp === 'number' ? payload.exp : 0
  return payload.role === 'authenticated' && exp * 1000 > Date.now()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (!ANTHROPIC_API_KEY) return json({ error: 'OCR not configured' }, 500)
  if (!isAuthed(req)) return json({ error: 'Unauthorized' }, 401)

  try {
    const { image, media_type } = await req.json()
    if (!image) return json({ error: 'No image' }, 400)

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: media_type ?? 'image/jpeg', data: image },
              },
              {
                type: 'text',
                text:
                  'This is a receipt. Return ONLY a JSON object like ' +
                  '{"amount": <grand total as a number>, "currency": "EUR"|"GBP"|"AUD"}. ' +
                  'Use the final total paid (including tax/service). ' +
                  'Infer currency from symbols (€=EUR, £=GBP, $=AUD) or words. ' +
                  'If you cannot read the total, use null for amount. No prose, no code fences.',
              },
            ],
          },
        ],
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      return json({ error: `Anthropic ${res.status}: ${body.slice(0, 300)}` }, 502)
    }
    const data = await res.json()
    const text: string = data?.content?.[0]?.text ?? '{}'

    let parsed: { amount: number | null; currency: string | null } = { amount: null, currency: null }
    try {
      parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
    } catch {
      // leave as nulls — client falls back to manual entry
    }

    const currency = ['EUR', 'GBP', 'AUD'].includes(parsed.currency ?? '') ? parsed.currency : null
    const amount = typeof parsed.amount === 'number' ? parsed.amount : null
    return json({ amount, currency })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
