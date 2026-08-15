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

Auth routes: `/login` (Google sign-in, restricted to @collectivep.com accounts) and `/auth/callback` (OAuth exchange). Signed-out users are redirected to `/login` by `src/middleware.ts`; after sign-in they return to their intended path. Non-workspace Google accounts are signed out and blocked at the edge, in the auth callback, and in the app shell. The Zustand store hydrates from Supabase on app load and every mutation persists back through `src/lib/supabase/data.ts`.

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
