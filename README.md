# CP Platform — Collective Perspectives

> Internal project management platform for Collective Perspectives.  
> *Redefining Ability. Reimagining Possibility.*

## Overview

A lightweight internal workspace for CP to coordinate projects, track tasks, record revenue, and report on delivery and impact.

## Features

- **Dashboard** — At-a-glance view of projects, tasks, revenue, and upcoming deadlines
- **Kanban Board** — Drag-and-drop task management across To Do → In Progress → Review → Done
- **Task Management** — Priority levels, assignees, due dates, filters, and inline status changes
- **Gantt Timeline** — Visual timeline view of project schedules and task durations
- **Sales Tracking** — Log revenue from grants, sponsorships, workshops, commissions, and artwork sales
- **Reports & Analytics** — Charts and breakdowns for sales, project progress, and team performance
- **Notifications** — Unread notifications with mark-all-read support

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) + React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + CP Editorial Operations design tokens |
| UI Components | Radix UI primitives + CVA |
| State Management | Zustand |
| Charts | Recharts |
| Icons | Lucide React |
| Auth, Database, Storage | Supabase |

## Getting Started

```bash
npm install
npm run dev
```

The development server uses Turbopack. Open [http://localhost:3456](http://localhost:3456) when using the project's SSH preview setup, or [http://localhost:3000](http://localhost:3000) for the default Next.js port.

## Supabase setup

Auth, the Postgres database, and avatar storage all run on Supabase. To enable them:

1. Create a Supabase project and open **Project Settings → API**.
2. Set the public env vars for both local and production:
   - `NEXT_PUBLIC_SUPABASE_URL` — your project URL (e.g. `https://xxx.supabase.co`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the public anon key
3. Run [`supabase/setup.sql`](supabase/setup.sql) once in the Supabase SQL editor. It creates the schema (`profiles`, `projects`, `tasks`, `sales`, `notifications`), enables row-level security for authenticated members, creates the public `avatars` storage bucket, links new auth users to team profiles via trigger, and seeds the CP roster/projects/tasks/sales.
4. In **Authentication → URL Configuration**, add your site URL plus redirect URLs so `/auth/callback` is reachable (needed for Google sign-in and email confirmation).
5. Optional: enable the **Google** provider in Authentication → Providers and add your OAuth client credentials.

Auth routes: `/login` (Google sign-in **or** email/password, restricted to @collectivep.com accounts) and `/auth/callback` (OAuth exchange). Signed-out users are redirected to `/login` by `src/middleware.ts`; after sign-in they return to their intended path. Non-workspace accounts are signed out and blocked at the edge, in the auth callback, and in the app shell. The Zustand store hydrates from Supabase on app load and every mutation persists back through `src/lib/supabase/data.ts`.

### Email/password admin sign-in (no Google)

For staff without an `@collectivep.com` Google account — and for deterministic automated testing (Playwright) — run [`supabase/admin-user.sql`](supabase/admin-user.sql) once in the Supabase SQL editor. It provisions a password-based `admin@collectivep.com` account (email pre-confirmed, so no inbox step), lets the existing trigger create the team profile, and promotes it to `admin`.

Then sign in at `/login` → **Sign in with email**:

```
email:    admin@collectivep.com
password: CPAdmin2026!
```

Change the password afterwards (Dashboard → Authentication → Users, or edit the constant in the script and re-run). The email/password form posts directly from the browser, so it does **not** depend on the Supabase Site URL / redirect URL configuration that Google OAuth needs — useful in preview environments where the host changes per session.

### CRUD troubleshooting

If the app loads but creating/editing/deleting projects, tasks, or sales doesn't stick (rows vanish on refresh), the usual cause is row-level security: the tables exist but the `*_all` policies from `setup.sql` were never applied to that Supabase project. Re-run [`supabase/setup.sql`](supabase/setup.sql) in the SQL editor. Since the app writes optimistically, a rejected write now records a message on the store and shows a dismissible **Sync issue** banner in the app shell with the exact Supabase error (e.g. `permission denied for table tasks`) — use that to confirm the fix.

## End-to-end tests (Playwright)

Playwright drives the real UI against a running app, signing in with the provisioned admin account (run [`supabase/admin-user.sql`](supabase/admin-user.sql) first).

Prereqs: install the browser once (plus OS libraries on Linux containers — the headless shell needs `libglib-2.0` and friends, which bare images often lack), and have the app reachable (the Freebuff preview, or `npm run dev` locally):

```bash
npx playwright install chromium
npx playwright install-deps chromium   # Linux only; requires root (apt-get)
```

Run against a local dev server:

```bash
npm run e2e
```

Run against the Freebuff preview (or any deployed URL):

```bash
E2E_BASE_URL=https://<preview-host> npm run e2e
```

Credentials default to `admin@collectivep.com` / `CPAdmin2026!`; override with `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` if you rotated the password. The suite covers auth (signed-out redirect, email/password sign-in) and create → edit → delete on Projects, Tasks, and Sales. Each test cleans up after itself; the HTML report lands in `playwright-report/`.

### GitHub Actions (pull requests)

[`.github/workflows/e2e.yml`](.github/workflows/e2e.yml) runs on every PR:

- **E2E (Chromium)** — builds the app and runs the full browser suite; gates the PR.
- **Supabase integration (live CRUD)** — runs `npm run test:integration` against your real project; gates the PR.

Add these repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key (public) |
| `E2E_ADMIN_EMAIL` | `admin@collectivep.com` (or your admin) |
| `E2E_ADMIN_PASSWORD` | the admin password from `supabase/admin-user.sql` |

The integration job needs a real, provisioned admin user — until `supabase/admin-user.sql` has run successfully, that job fails with a clear message (which is the signal that the provisioning step is still pending). If you see `Database error querying schema` on sign-in even though the user exists in Authentication → Users, that's the direct-SQL insert issue: the row is missing the empty-string token columns (NULL breaks GoTrue's scan) and/or the `auth.identities` row (the dashboard shows **Providers: blank** when it's missing). **Re-run `supabase/admin-user.sql`** — it repairs both in place (tokens + email identity) and rotates the password, so the account can actually sign in.

## Live API integration tests

The app has no REST endpoints of its own — the browser talks to Supabase directly through `src/lib/supabase/data.ts`. The integration suite runs that **real data layer** against your live Supabase project with the admin session, verifying schema, row-level security, and the full CRUD round-trip exactly as the app experiences it:

```bash
npm run test:integration
```

Prereqs: the env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — read from `.env.local`/`.env` or the environment) and the admin account from `supabase/admin-user.sql`. It covers:

- `fetchTeamData` loads users/projects/tasks/sales/notifications
- **RLS sanity check** — an anonymous client sees zero project rows (catches a project with RLS accidentally disabled)
- Projects, Tasks, Sales: create → read → update → delete round-trips (including FK constraints: tasks/sales attach to a real project, assignee/owner to a real profile)
- Notifications: insert → mark-read

Every test cleans up the rows it creates. Interpretation: a `permission denied` / `new row violates row-level security policy` error means the `*_all` policies from `supabase/setup.sql` are missing from that project — re-run it; a passing anon-query assertion means RLS is correctly enforced.

```bash
npm run build
npm start
```

## Design system

The platform follows **CP Editorial Operations**, an internal Operate-mode expression of Collective Perspectives' public visual language:

- **Ink + paper foundation** for high contrast and calm scanning
- **CP Coral** for scarce expressive emphasis and urgency
- **Selection Purple** for focus, active navigation, and selected states
- **Completion Teal** and **Attention Mustard** for semantic workflow states
- **Sora** for hierarchy and **DM Sans** for readable operational UI
- **Flat-by-default surfaces**, quiet dividers, and purposeful motion

Persistent design context lives in `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`, and the route briefs under `.impeccable/surfaces/`. Run `npx impeccable detect src/` before shipping UI changes.

## Impeccable workflow

Impeccable is installed project-local for the detected coding clients: Claude Code, Cursor, Gemini CLI, Codex CLI, OpenCode, and Pi. The installed skill payload reports v4.0.4; the invoking `npx impeccable` CLI currently reports 3.5.0, so keep the skill and CLI updated together with `npx impeccable update`.

```bash
# Keep the project-local skills and hooks current
npx impeccable update
npx impeccable check

# Initialize or refresh durable project context when product truth changes
# Run this from an Impeccable-enabled coding client:
/impeccable init

# Review or validate UI work
npx impeccable detect src/
/impeccable critique src/app/(app)/page.tsx
/impeccable audit src/app/(app)/page.tsx

# Check or repair the project design hook
/impeccable hooks status
/impeccable hooks on
```

The repository uses Impeccable's official skill, CLI, and provider-native hook workflow documented at [impeccable.style](https://impeccable.style/docs/init/). No verified official Impeccable MCP integration was found or configured; the supported workflow used here is skill + CLI + hooks. Do not add an MCP entry unless a future official Impeccable release documents one for the client being used.

Provider notes:

- Claude Code uses `.claude/settings.local.json` and `.claude/skills/impeccable/`. The local settings file is developer/machine-local; use the client’s shared settings mechanism if the team explicitly wants a committed shared hook.
- Codex CLI uses `.codex/hooks.json` and `.agents/skills/impeccable/`; Codex may require one-time hook approval in `/hooks`.
- Cursor uses `.cursor/hooks.json`, `.cursor/agents/`, and `.cursor/skills/impeccable/`; confirm hooks are enabled in Cursor settings.
- Gemini CLI, OpenCode, and Pi have project-local Impeccable skill directories. Their skill is installed, but automatic provider-native hooks are not assumed unless that client documents and enables them.
- Hook consent/settings can be client-local. Do not commit personal consent files unless the team explicitly wants shared behavior.
- Command prefixes vary by client: Claude/Cursor/Gemini/OpenCode/Pi use `/impeccable ...`; Codex uses `$impeccable ...`.

Run the context loader once per design session with a route target when working directly from a shell, for example:

```bash
node .agents/skills/impeccable/scripts/context.mjs --target 'src/app/(app)/page.tsx'
```

This loads the matching product, design, and surface context before a critique or UI change. The current design sidecar may need refreshing after later `DESIGN.md` edits; use `/impeccable document` only when you intentionally want to regenerate the visual-system metadata.

## Project structure

```
src/app/                 # App Router, route group, global tokens
src/components/          # Shell, charts, and shared UI primitives
src/lib/                 # Types, Zustand store, seed data, utilities
PRODUCT.md               # Durable product truth
DESIGN.md                # Canonical visual design contract
.impeccable/             # Persistent Impeccable tokens and surface context
```

Built for Collective Perspectives — a Singapore-based social enterprise empowering Persons living with Disabilities through creative platforms, skills development, and economic activities.
