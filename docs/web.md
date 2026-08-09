# Recipe Vault — Web App (Phase B: App Shell)

Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel's free tier.
Auth via `@supabase/ssr` against the production Supabase project. Phase B is the
shell only: design system, auth, navigation, and a live dashboard. Recipe CRUD,
import, and AI come in later phases.

## Stack

- **Next.js 15** App Router, React 19, TypeScript (strict).
- **Tailwind CSS v3** — design tokens are CSS custom properties in
  `app/globals.css`, referenced from `tailwind.config.ts`. Change a color once
  there and it updates everywhere. No component library, no state library.
- **Fonts:** Fraunces (serif display) + Inter (sans body), self-hosted via
  `next/font`.
- **Supabase** `@supabase/ssr` — a browser client (`lib/supabase/client.ts`) and
  a server client (`lib/supabase/server.ts`). The server client runs queries as
  the signed-in user, so **Row Level Security does the ownership filtering** —
  application code never filters by `user_id`.

## Environment variables

Copy `.env.example` to `.env.local` (git-ignored) for local work, and set the
same keys in Vercel → Project Settings → Environment Variables.

| Variable | Exposure | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | `https://drjshqggefvxthxgyhte.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | `sb_publishable_…` key, client-safe |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Not used in Phase B. Never prefix with `NEXT_PUBLIC_`. |

The service role key must never reach the browser. Phase B needs only the two
public values.

## Auth model

Single household — **no public signup screen**. Create the user in the Supabase
dashboard (Authentication → Users → Add user, with a password). On first login,
the `auth.users` insert trigger has already provisioned that user's `profiles`
row plus default tags, collections, equipment, and stores.

- `middleware.ts` refreshes the session on every request and guards routes:
  unauthenticated → `/login` (preserving the intended path); an authenticated
  user hitting `/login` → dashboard.
- Public routes: `/login`, `/auth/*`, `/reset-password`. Everything else
  requires a session.
- Password reset: "Forgot password?" on the login screen emails a link →
  `/auth/callback` exchanges the code → `/reset-password` sets the new password.

## Local development

Requires Node 20+ (not available in every environment — the app is built by
Vercel on push regardless).

```bash
npm install
cp .env.example .env.local   # then fill in the publishable key
npm run dev                  # http://localhost:3000
```

## Deploy to Vercel (free tier)

1. Vercel → **Add New… → Project** → import the GitHub repo
   `jimhuber-dotcom/recipe--vault`.
2. Framework preset: **Next.js** (auto-detected). Root directory: repo root.
   Build command and output are Next defaults — leave them.
3. Add the two `NEXT_PUBLIC_` environment variables above (Production + Preview).
4. **Deploy.** Every push to `main` redeploys automatically.

Note: `supabase/` and `scripts/` live in the same repo but are irrelevant to the
Vercel build — Next only builds the app.

## Routes

| Path | Screen | State |
|---|---|---|
| `/` | Dashboard | Live queries |
| `/login`, `/reset-password` | Auth | Built |
| `/library` | Library | Stub |
| `/favorites` | Favorites | Stub |
| `/collections` | Collections | Stub |
| `/inbox` | Inbox (review queue) | Stub |
| `/import` | Import | Stub |
| `/search` | Search | Stub |
| `/settings` | Settings | Stub (sign-out lives here on mobile) |
| `/recipes/[id]` | Recipe detail | Stub |
| `/recipes/[id]/edit` | Review & edit | Stub |

Stubs render a `PageHeader` and an `EmptyState` only — they are intentionally
not built out in Phase B.
