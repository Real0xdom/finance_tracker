# Finance Tracker

A personal budget & finance tracker — a fork of [Ocular](https://github.com/simonwep/ocular) by Simon Reinisch (MIT),
rewired to run on [Supabase](https://supabase.com) (auth + storage) and deploy as a static site on [Vercel](https://vercel.com).

## Features

- 📊 Dashboard with extensive statistics and multiple charts including a Sankey diagram.
- 📅 Track budgets across multiple years with an all-time overview.
- 🔐 Email/password login via Supabase — your data syncs across devices.
- 🛡️ Row-level security: every user can only ever read and write their own data.
- 🎨 Light and dark mode, installable as a PWA, optimized for mobile.
- 🌍 Multi-language and support for all common currencies.
- 🔁 Import from Google Sheets' annual planner, export as JSON.
- 🕶️ Privacy mode for when you're in a public place.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and run it.
3. Create your login under **Authentication → Users → Add user** (check _Auto Confirm User_).
4. Recommended: disable public sign-ups under **Authentication → Sign In / Providers → Email**.

### 2. Environment variables

Copy `.env.example` to `.env` and fill in the values from **Project Settings → Data API / API Keys**:

```
OCULAR_SUPABASE_URL=https://<your-project>.supabase.co
OCULAR_SUPABASE_ANON_KEY=<your anon / publishable key>
```

### 3. Run locally

```sh
corepack enable
pnpm install
pnpm dev
```

Log in with your Supabase user's **email** in the username field.

### 4. Deploy to Vercel

Import this repository in Vercel (framework preset is picked up from `vercel.json`) and add the two
environment variables above under **Project → Settings → Environment Variables**, then deploy.

## License

MIT — based on [Ocular](https://github.com/simonwep/ocular) © Simon Reinisch.
