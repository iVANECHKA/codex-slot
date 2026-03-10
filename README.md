# Aurelia Casino Simulator

Mobile-first casino simulator built with Next.js, TypeScript, Tailwind, reusable game engines, and a Supabase-ready backend layer.

## What is included

- Luxury casino UI with landing page, auth, lobby, profile, and game detail screens
- Simple login + password onboarding
- 3 slots with configurable paylines, reels, bonus buys, and symbol metadata
- Crash game with seeded bust point, isolated rounds, and optional auto cashout
- Mines with server-owned boards and progressive multiplier cashout
- Demo repository for local development when Supabase env is not configured
- Supabase schema and seed files for moving to a real backend
- Unit tests for RNG and core game engines

## Run locally

```bash
npm install
npm run dev
```

The app works in `demo` mode without Supabase. To switch to Supabase-backed auth/storage, add the variables from `.env.example` and apply the SQL in [`supabase/schema.sql`](./supabase/schema.sql) plus [`supabase/seed.sql`](./supabase/seed.sql).

## Important notes

- This is a simulator only. No real-money deposits, withdrawals, or KYC are included.
- Game outcomes are computed on the server route handlers, not on the client.
- Slot symbols already support `imageUrl` fields in config and the schema includes `slot_symbol_assets` so reel imagery can be swapped from backend storage.
- The demo repository is in-memory, so balances and sessions reset when the dev server restarts.

## Scripts

```bash
npm run dev
npm run lint
npm run test
npm run build
```

## Deploy to GitHub Pages

- A workflow is provided in `.github/workflows/deploy-pages.yml`.
- In repository settings, set **Pages -> Source** to **GitHub Actions**.
- Push to `main` to trigger deployment.

Notes:

- Pages runs a static export, so backend API routes are excluded from the Pages build.
- For Pages preview, the app automatically uses client-side demo storage so auth and games can be tested without server API.

