# CP Platform — Collective Perspectives

> Internal project management platform for Collective Perspectives.  
> *Redefining Ability. Reimagining Possibility.*

## Overview

A modern, lightweight project management platform built for the CP team to track projects, tasks, sales revenue, and team performance — all in one place.

## Features

- **Dashboard** — At-a-glance view of projects, tasks, revenue, and upcoming deadlines
- **Kanban Board** — Drag-and-drop task management across To Do → In Progress → Review → Done
- **Task Management** — Full CRUD with priority levels, assignees, and due dates
- **Gantt Timeline** — Visual timeline view of project schedules and task durations
- **Sales Tracking** — Log revenue from grants, sponsorships, workshops, commissions, and artwork sales
- **Reports & Analytics** — Charts and breakdowns for sales, project progress, and team performance
- **Notifications** — Real-time notification system with unread badges and mark-all-read

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) + React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + custom CP design system |
| UI Components | Radix UI primitives + CVA |
| State Management | Zustand |
| Charts | Recharts |
| Icons | Lucide React |

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) to access the platform.

## Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Dashboard
│   ├── globals.css         # CP design system & theme
│   ├── projects/page.tsx   # Kanban board + list view
│   ├── tasks/page.tsx      # Task management table
│   ├── gantt/page.tsx      # Gantt timeline view
│   ├── sales/page.tsx      # Sales tracking
│   └── reports/page.tsx    # Reports & analytics
├── components/
│   ├── ui/                 # Reusable UI primitives
│   ├── sidebar.tsx         # Navigation sidebar
│   ├── topbar.tsx          # Top bar with search & notifications
│   ├── app-shell.tsx       # App layout wrapper
│   ├── dashboard-chart.tsx # Dashboard area chart
│   └── reports-charts.tsx  # Report page charts
└── lib/
    ├── types.ts            # TypeScript type definitions
    ├── store.ts            # Zustand state management
    ├── seed-data.ts        # Demo data
    └── utils.ts            # Utility functions
```

## Design System

The platform uses a custom design system reflecting CP's brand DNA:

- **Primary Purple** `#8b46ff` — Visionary, creative energy
- **Coral** `#ff6b4a` — Bold, passionate action
- **Teal** `#14b8a0` — Growth, progress, completion
- **Mustard** `#ffd633` — Warmth, attention, highlights

Typography: **Plus Jakarta Sans** (headings) + **Inter** (body)

## Team

Built for Collective Perspectives — a Singapore-based social enterprise empowering Persons with Disabilities through creative platforms, skills development, and economic activities.

---

*Built with ❤️ for the CP family*
