// Reads a receipt photo and returns { amount, currency } using Claude vision.
// Deploy:  supabase functions deploy read-receipt
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (!ANTHROPIC_API_KEY) return json({ error: 'OCR not configured' }, 500)

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

    if (!res.ok) return json({ error: `Anthropic ${res.status}` }, 502)
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
