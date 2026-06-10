# euro-2026-expenses-splitter
Expense splitting app for euro 2026 holiday spend

---

# Euro 2026 Expenses Splitter

A mobile-first **PWA** for tracking shared travel spend across **EUR, GBP and AUD**.
It shows, live, **what you owe your wife** — an editable percentage (default **25%**)
of *her* spend. Your own purchases are tracked separately and never reduce what you owe.

- 📷 **Snap a receipt** and the total is read automatically (you confirm it); manual entry always works.
- 🔌 **Works offline** — everything saves on-device instantly and **syncs both phones** when back online.
- 💱 Owed amount shown in **EUR, GBP and AUD** at once, using live ECB rates (cached for offline, manual override available).
- 🔀 **Switch any expense on/off** without deleting it — toggled-off items leave all totals.
- 🏷️ Tag **business/personal** + a note, and export a **CSV** for her expense claims.

---

## Quick start (local, device-only)

No backend needed to try it — it runs on one device with browser storage:

```bash
npm install
npm run dev
```

Open the URL it prints. Without Supabase keys the app runs in **“On this device”** mode
(no cross-phone sync). Add the keys below to enable sync + receipt auto-read.

## Full setup (sync across both phones + receipt OCR)

### 1. Create a Supabase project
At [supabase.com](https://supabase.com) (free tier is plenty). Then in **SQL Editor**,
run the migration in [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
(creates tables, row-level security, the join function, and the `receipts` storage bucket).

### 2. Add the web app keys
Copy `.env.example` → `.env.local` and fill in from **Project Settings → API**:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 3. Deploy the receipt-reader (OCR)
Uses Claude vision (`claude-haiku-4-5`) — about **$0.001 per receipt**.

```bash
# install the Supabase CLI, then:
supabase link --project-ref YOUR-PROJECT-REF
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...        # get one at console.anthropic.com
supabase functions deploy read-receipt
```

The API key lives **only** on the server — it is never shipped to the browser.

### 4. Build / host
```bash
npm run build      # outputs to dist/
```
Host `dist/` anywhere static (Netlify, Vercel, Cloudflare Pages, GitHub Pages).
On each phone open the site in Safari/Chrome → **Share → Add to Home Screen** to install it.

## How you and your wife share one ledger
1. You sign in (magic-link email) and tap **Start new** → a trip is created with a **6-letter join code** (see Settings).
2. She opens the same site, signs in, taps **Join with code**, and enters that code.
3. Both phones now read/write the same ledger and sync automatically.

## Tips
- **Free OCR alternative (iPhone):** even without the cloud reader you can snap the
  receipt, long-press the photo, and use iOS **Live Text** to copy the total, then
  paste it into the amount field. (A web app can’t trigger Live Text automatically,
  so this step is manual.)
- **Offline:** add expenses on the plane / with no signal — a badge shows how many
  are waiting; they upload the moment you reconnect.

## How “what you owe” is calculated
```
owed = percentage% × (sum of wife’s ACTIVE spend, converted per currency)
```
Switched-off and deleted expenses are skipped. Your own spend is shown for reference
but never subtracted. See [`src/lib/settlement.ts`](src/lib/settlement.ts).

## Project layout
- `src/lib/` — `db` (Dexie/IndexedDB), `sync`, `fx`, `settlement`, `repo`, `session`, `ocr`, `supabase`
- `src/hooks/` — live data, sync state, online status
- `src/screens/` — Dashboard, AddExpense, ExpensesList, Settings, Onboarding
- `supabase/` — SQL migration + `read-receipt` Edge Function
