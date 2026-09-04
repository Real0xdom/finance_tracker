# Money — personal finance tracker

A small Android app for tracking money day to day, built around fast entry rather
than a budget spreadsheet. Talks to the same Supabase project the old Ocular app
used, but through its own `ft_*` tables — the legacy `user_data` table is never
touched, so the old app keeps working.

## Four cards

| Card | What it holds |
|---|---|
| **Income** | fixed monthly streams (salary) posted with one tap, plus one-off extra income |
| **Spending** | per-day expense entry, search-first |
| **Lending** | money lent out, tracked to repayment — deliberately **not** counted as expense |
| **Investment** | SIPs and funds — money that left the account but is still yours |

Analysis and Settings sit alongside them in the bottom bar.

## Why entry is fast

The spend screen opens with the cursor in one search box that matches **both**
past items and categories. Typing `egg` surfaces the previous egg purchase with
its category and last amount already attached: tap it, adjust the number, save.
The category stays selected after saving, so several items from the same shop go
in one after another without re-picking anything. No scrolling a category tree.

Quantity and remarks are there when you want them and skippable when you don't.
The day stepper at the bottom means yesterday's forgotten entries take two taps.

## Setup

### 1. Create the tables

Supabase does not allow schema changes over its REST API, so this step is manual
and only happens once.

Dashboard → **SQL Editor** → New query → paste all of
[`supabase/schema.sql`](supabase/schema.sql) → **Run**.

It creates `ft_categories`, `ft_transactions`, `ft_recurring`, `ft_settings`,
each with row level security so only your own rows are ever readable.

### 2. Bring the old data across

The legacy data is monthly totals per category row — `values[12]` per row, one
number per month. Row *names* carry the item detail (`Egg`, `X-ray`, `Mangesh`),
so each populated cell becomes one transaction with that name as its note. What
the old format never stored is the **day within the month** or a **quantity**, so
imported rows are dated to the 1st and flagged `imported = true`; the app labels
them "imported — month total" rather than pretending they were single purchases.

Groups are routed by meaning, not just copied: `Investment` becomes investment
rows, `Lended friends` becomes lending rows (so that money is not counted as
spent), everything else on the expense side stays an expense.

Put your credentials in `tracker/.env.migrate` (gitignored):

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
MIGRATE_USER_ID=<your auth user id>
```

Then:

```bash
npm run migrate:dry   # report what it would write, change nothing
npm run migrate       # apply
```

The importer reads `data/user_data_rows.json` if present, otherwise the live
`user_data` table. It is **idempotent**: each run clears rows where
`imported = true` and rewrites them, so hand-entered transactions are never
disturbed and it is safe to re-run.

Delete the service role key once the import is done — it bypasses row level
security entirely.

### 3. Build the APK

Both keys come from Supabase → Project Settings → **Data API** (URL) and
**API Keys** (anon / publishable key). Add them as repository secrets under
Settings → Secrets and variables → Actions:

- `FT_SUPABASE_URL`
- `FT_SUPABASE_ANON_KEY`

Then push, or run **Build Android APK** from the Actions tab. The finished
`money-<sha>.apk` is attached to the run as an artifact — download it on your
phone and install (Android will ask you to allow installing from that source).

It is a debug-signed APK, which is all sideloading onto your own device needs.

### Running locally instead

```bash
cp .env.local.example .env.local   # fill in the same two values
npm install
npm run dev
```

## AI analysis

The analysis tab works with no configuration: it computes its observations
locally — biggest category and its share, per-day average, how much of your
income you kept, the month-over-month change, and whether one entry dominates.

Add a **Google Gemini API key** in Settings to get a written analysis instead.
The key is verified before it is saved, stored on your own `ft_settings` row, and
sent only to Google. Every figure Gemini is allowed to quote is passed to it as a
factual brief, so it summarises and advises rather than inventing numbers. If the
key fails or Gemini is unreachable, the tab silently falls back to the local
analysis and says so.

## Data model notes

`ft_transactions.kind` is what keeps the reporting honest:

- `expense` — gone for good
- `income` — arrived
- `investment` — left the account, still yours; reported separately from spending
- `lending` — expected back; excluded from expense totals
- `repayment` — a lending coming back, linked to the original row via `lend_id`

`ft_recurring.every_n_months` covers both monthly items and the quarterly ones —
set it to `3` for the trip you make every third month and it lands automatically
in the right months.
