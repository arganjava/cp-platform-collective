# 📋 CP Platform - Project Review & Insights

**Date:** September 2, 2026  
**Project:** CP Platform (Collective Perspectives Internal Project Management)  
**Status:** Handover Review Complete

---

## 🎯 Project Purpose

CP Platform adalah internal project management workspace untuk Collective Perspectives, sebuah social enterprise kreatif berbasis di Singapura. Platform ini menggantikan spreadsheet terpisah dengan unified tool untuk:

- **Projects Management** — Kanban board & list view untuk koordinasi project
- **Task Tracking** — Full lifecycle management dengan filters & search
- **Revenue Tracking** — Sales/komisi tracking dalam SGD per project/type
- **Analytics & Reports** — Dashboard metrics, charts, timelines
- **Team Collaboration** — Real-time updates, notifications, bersama @collectivep.com team

**Filosofi:** Lightweight, specialized project management—bukan generic SaaS. Membawa CP's brand identity (high contrast, human language, direct hierarchy) ke internal tool.

---

## 🏗️ Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Runtime** | Node.js | Latest |
| **Framework** | Next.js | 15 |
| **UI Library** | React | 19 |
| **Language** | TypeScript | 5 |
| **Styling** | Tailwind CSS + Radix UI | 4.x |
| **State Management** | Zustand | 5.x |
| **Database** | Supabase (PostgreSQL) | Latest |
| **Auth** | Google OAuth + Email/Password | @collectivep.com domain |
| **Charts** | Recharts | 2.x |
| **Testing** | Vitest + Playwright | 4.x |
| **Icons** | Lucide React | - |
| **Form Validation** | Zod | - |

---

## 📁 Folder Structure Overview

```
src/
├── app/              # Next.js app directory
│   ├── (app)/        # Protected routes (dashboard, projects, tasks, sales, reports, gantt)
│   ├── auth/         # OAuth callback
│   ├── login/        # Login page
│   ├── layout.tsx    # Root layout
│   └── globals.css   # Design tokens & theme
├── components/       # React components
│   ├── app-shell.tsx # Main app wrapper
│   ├── sidebar.tsx
│   ├── topbar.tsx
│   ├── dashboard-chart.tsx
│   ├── report-components.tsx
│   └── ui/           # shadcn/ui primitive components
└── lib/
    ├── store.ts      # Zustand state management (80% business logic)
    ├── types.ts      # Domain types (User, Project, Task, Sale)
    ├── utils.ts      # Helper functions
    └── supabase/
        ├── client.ts # Supabase client (browser)
        ├── server.ts # Supabase client (server-side)
        ├── data.ts   # Data layer (queries, mutations)
        └── types.ts  # Database row types

supabase/
├── setup.sql         # Schema, RLS policies, seed data
├── migrations/       # Database migrations
├── config.toml       # Supabase local config
└── admin-user.sql    # Admin user setup
```

---

## 💾 Database Schema

### Tables

**profiles**
- 8 seeded users (@collectivep.com)
- Roles: admin, manager, member
- User info: name, email, avatar_url, role

**projects**
- 5 seeded projects: DARE Festival, Fragrance Launch, Poetry Book, Training, Content Hub
- Fields: name, description, status, progress, color, owner_id
- Color-coded UI (scarlet, indigo, teal, amber, slate)

**tasks**
- 20+ seeded tasks
- Fields: title, description, status (backlog/todo/in-progress/done), priority (low/medium/high), project_id, assignee_id, due_date, created_at
- Flat hierarchy (no subtasks yet)

**sales**
- 15+ seeded revenue records
- Fields: amount (SGD), type (commission/artwork/workshop/grant), project_id, date, notes
- Quick revenue tracking

**notifications**
- Unread count system
- Fields: user_id, type, content, is_read, created_at

### Security

**RLS Policies:**
- All @collectivep.com authenticated users: full read/write access
- ⚠️ Flat permissions—no per-project access control yet
- Email validation at middleware level

---

## 🎨 Design System (Architect's Binder)

**Core Principle:** Binder metaphor—internal tool feels like organized architect's binder with sheets

**Color Palette:**
- **Background:** Warm vellum #faf9f7
- **Text:** Ink #1a1a1a
- **Accent:** Coral #e85d3f (scarce, high impact)
- **Dark mode:** Inverse of light with maintained WCAG AA contrast

**Typography:**
- **Headings:** Bricolage Grotesque (bold, distinctive)
- **Body:** Spline Sans (readable, modern)
- **Data:** JetBrains Mono (precise, code-like)

**Geometry:**
- Square corners (border-radius: 0px)
- Clean lines, minimal decoration
- Sheet numbering (01–06) in sidebar reinforces binder

---

## ⚙️ Architecture Patterns

### 1. Fire-and-Forget Persistence
```
User Action → Zustand Update (Instant) → UI Responds
                ↓
          Supabase Mutation (Async)
                ↓
          Error? → Show Dismissible Banner
```
- UX feels snappy, no spinners
- Errors surface gracefully as notifications

### 2. Zustand State Management
- `store.ts` contains ~80% of business logic
- Global state: projects, tasks, sales, notifications, filters, UI state
- Strongly typed, easy to trace data flow

### 3. Data Layer Abstraction
- `supabase/data.ts` handles all CRUD operations
- Clean separation: UI → Zustand → Data Layer → Supabase
- Easy to mock, test, or swap database

### 4. Type Safety
- Domain types: `User`, `Project`, `Task`, `Sale`, `Notification`
- DB types: `ProfileRow`, `ProjectRow`, etc.
- Full TypeScript 5, strict mode enabled

### 5. Middleware & Route Protection
- Email policy enforced at edge
- Unauthenticated → /login
- Non-@collectivep.com → rejected
- App shell loads all team data on boot

### 6. Responsive Design
- Tailwind CSS, mobile-first
- Sidebar collapses on small screens
- Charts/tables adapt to viewport

---

## ✅ Strengths

| Strength | Impact |
|----------|--------|
| **Type-safe** | TypeScript everywhere, no any's, Zod validation |
| **Accessible** | Radix primitives, WCAG AA, keyboard navigation |
| **Fast UX** | Fire-and-forget updates, optimistic rendering |
| **Security-first** | Email policy, RLS, middleware validation, OAuth |
| **Scalable patterns** | Clean Zustand, data layer, component structure |
| **Thoughtful branding** | Binder metaphor, CP identity throughout |
| **Test coverage** | Unit (Vitest), integration, E2E (Playwright) |
| **Seed data** | Realistic demo data, ready for dev/presentation |

---

## ⚠️ Gaps & Technical Debt

| Issue | Severity | Impact | Notes |
|-------|----------|--------|-------|
| **Gantt/Timeline incomplete** | 🔴 High | Routes exist, no UI built | Sheet 04 is skeleton only |
| **Reports skeleton** | 🟡 Medium | Foundation set, details TBD | Sheet 06 foundation laid |
| **No subtasks** | 🟡 Medium | Task hierarchy is flat | Single-level only |
| **No recurring tasks** | 🟡 Medium | Can't repeat tasks | One-off entries only |
| **Comments not wired** | 🟡 Medium | Table exists, no UI | DB schema ready, needs UI |
| **Notifications incomplete** | 🟡 Medium | Table exists, no triggers | No real-time notifications |
| **No activity log** | 🔵 Low | No audit trail | Mutations not tracked by user |
| **Flat RLS** | 🟡 Medium | All team sees all projects | No per-project access control |
| **Client-side search only** | 🟡 Medium | Limited to loaded data | No full-text DB search |
| **No bulk operations** | 🔵 Low | Select & batch update missing | Can update one item at a time |

---

## 📊 Features Matrix

### Dashboard (Sheet 01) ✅ Complete
- Metrics cards (total projects, tasks, revenue)
- Recent activity
- Upcoming deadlines
- Revenue chart

### Projects (Sheet 02) ✅ Complete
- Kanban board view
- List view with filters
- Color-coded by project
- Progress tracking

### Tasks (Sheet 03) ✅ Complete
- Full CRUD lifecycle
- Status & priority filters
- Search functionality
- Sort by due date, priority, assignee

### Timeline/Gantt (Sheet 04) 🔲 Incomplete
- Routes exist: `/gantt`
- No UI components built
- Needs: drag-to-reschedule, milestone view, resource allocation

### Sales (Sheet 05) ✅ Complete
- Revenue tracking (SGD)
- By project/type
- Charts & summaries
- Commission tracking

### Reports (Sheet 06) 🟡 Skeleton
- Foundation layout built
- Components scaffolded
- Details TBD

---

## 🔐 Authentication & Authorization

**Auth Flow:**
1. Google OAuth (preferred) via Supabase
2. Email/password backup (@collectivep.com domain only)
3. Email validation at middleware
4. Session management via Supabase auth

**Current Permissions:**
- All @collectivep.com users: full read/write
- No granular project-level access control
- No approval workflows

---

## 🚀 Getting Started Commands

**Development:**
```bash
npm install
npm run dev          # Start Next.js dev server
npx supabase start   # Start local Supabase
```

**Testing:**
```bash
npm run test              # Vitest unit tests
npm run test:integration  # Integration tests
npm run test:e2e          # Playwright E2E
```

**Database:**
```bash
npx supabase db push     # Push migrations
npx supabase seed seed   # Load seed data
```

---

## 🎯 Next Steps & Recommendations

### Quick Wins (Priority 1)
1. ✅ Complete Gantt chart UI (Sheet 04)
2. ✅ Wire up comments feature (UI + realtime)
3. ✅ Complete Reports details (Sheet 06)

### Medium-term (Priority 2)
1. Add per-project access control (RLS enhancement)
2. Add subtask support
3. Add recurring task templates
4. Implement real-time notifications
5. Add activity/audit log

### Long-term (Priority 3)
1. Full-text search backend
2. Bulk operations (multi-select, batch update)
3. Approval workflows
4. Time tracking integration
5. Resource allocation & capacity planning

---

## 📝 Code Quality Notes

**Excellent:**
- TypeScript strict mode, no `any` types
- Component composition is clean and reusable
- Zustand state is well-organized
- Database queries properly typed
- Error handling with try-catch & user feedback

**Areas for Improvement:**
- Some components could be more modular
- More comprehensive unit test coverage needed
- E2E tests could cover more user workflows
- Consider adding React Query for server state
- Document complex Zustand selectors

---

## 📚 Key Files to Know

| File | Purpose | LOC | Complexity |
|------|---------|-----|-----------|
| `src/lib/store.ts` | Zustand state management | 500+ | High |
| `src/lib/supabase/data.ts` | Data layer CRUD | 300+ | Medium |
| `src/lib/types.ts` | Domain types | 100+ | Low |
| `src/app/globals.css` | Design tokens & theme | 200+ | Medium |
| `supabase/setup.sql` | Schema, RLS, seed | 400+ | High |
| `src/components/app-shell.tsx` | App wrapper | 150+ | Medium |

---

## 🤝 Team Observations

**Project Health:** 8/10
- Well-structured, type-safe codebase
- Clear architecture and separation of concerns
- Thoughtful UX/design system
- Some features incomplete but framework is solid

**Handover Readiness:** 8/10
- Good documentation (DESIGN.md, PRODUCT.md)
- Seed data makes it easy to test
- Tests provide safety net
- Architecture is understandable

**Recommendation:** This is solid foundation. Focus on completing incomplete features (Gantt, Reports, Comments) before adding new complexity. Then add per-project access control and real-time features.

---

## 💡 Questions for Previous Developer

1. Why is Gantt chart incomplete? (Priority? Timeline?)
2. Reports sheet—what's the vision for Sheet 06?
3. Are there specific features planned but not started?
4. Any known bugs or edge cases?
5. Performance concerns with larger datasets?
6. Any customer feedback that should influence priorities?

---

**Ready for Task Assignment** ✅

Saya sudah memahami arsitektur, patterns, dan current state dari CP Platform. Siap menerima task dari Anda!

