---
name: CP Platform
description: Architect's Project Binder — a coordination, delivery, revenue, and reporting workspace for Collective Perspectives.
colors:
  background: "#faf9f7"
  foreground: "#1a1a1a"
  card: "#ffffff"
  primary: "#1a1a1a"
  secondary: "#f4f2ee"
  muted: "#f4f2ee"
  muted-foreground: "#525252"
  accent: "#fbe5df"
  destructive: "#c44a30"
  border: "#e4e1dc"
  input: "#c9c5be"
  ring: "#c44a30"
  brand: "#e85d3f"
  subtle-foreground: "#8a8580"
  sidebar: "#1a1a1a"
  sidebar-foreground: "#a8a39d"
  sidebar-primary: "#e85d3f"
  sidebar-accent: "#2a2a2a"
typography:
  heading:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontWeight: 700
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Spline Sans, system-ui, sans-serif"
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontWeight: 400
rounded:
  none: "0px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"

# Design System: Architect's Project Binder

## Concept

Each route is a numbered sheet in an architect's project binder. The sidebar is a binder-cover sheet index. Title blocks, ruled panels, drawing-register language, and revision marks structure the interface. The canvas is warm vellum; structure is ink; the coral signature accent is scarce and deliberate.

**Anti-patterns avoided:** Generic SaaS stat cards, icon tiles, gradients, excessive pills, rounded-card grids, decorative hover lifts, floating shadows on resting elements.

## Framework: shadcn/ui

This project uses the [shadcn/ui](https://ui.shadcn.com) architecture:

- **Radix primitives** own behavior and accessibility.
- **CVA** owns controlled component variants.
- **Tailwind CSS v4** owns styling via semantic CSS variables.
- **`cn()`** (clsx + tailwind-merge) combines class names.
- **Lucide React** is the sole icon family — tree-shakeable, visually consistent.
- **Components are local and editable** — copied into `src/components/ui/`, not imported from a package.

### Adding components

```bash
npx shadcn@latest add <component>
```

Generated code lands in `src/components/ui/`. It uses standard semantic tokens (`bg-background`, `text-foreground`, `border-border`, etc.) so it inherits the binder theme automatically.

### After generating

1. Remove any `rounded-md` / `rounded-lg` — this project uses square geometry (`--radius: 0px`).
2. Verify variants match the semantic variant system (see Badge/Button below).
3. Remove unused imports.
4. Run `npm run lint && npm run build`.

### Theming

All theme values live in `src/app/globals.css` under `:root`. Change a variable there and every component updates:

```css
:root {
  --primary: #1a1a1a;    /* ink */
  --accent: #fbe5df;     /* soft coral */
  --destructive: #c44a30; /* deep coral */
  --radius: 0px;         /* square geometry */
}
```

Tailwind v4 maps these to utilities via `@theme inline`:

```css
@theme inline {
  --color-primary: var(--primary);
  --color-background: var(--background);
  /* ... */
}
```

### Standard semantic tokens

| Token | Utility | Value | Purpose |
|-------|---------|-------|---------|
| `--background` | `bg-background` | #faf9f7 | App canvas |
| `--foreground` | `text-foreground` | #1a1a1a | Primary text |
| `--card` | `bg-card` | #ffffff | Cards, panels, inputs |
| `--card-foreground` | `text-card-foreground` | #1a1a1a | Text on cards |
| `--popover` | `bg-popover` | #ffffff | Dropdowns, popovers |
| `--primary` | `bg-primary` | #1a1a1a | Primary actions, ink |
| `--primary-foreground` | `text-primary-foreground` | #ffffff | Text on primary |
| `--secondary` | `bg-secondary` | #f4f2ee | Sunken surface |
| `--secondary-foreground` | `text-secondary-foreground` | #1a1a1a | Text on secondary |
| `--muted` | `bg-muted` | #f4f2ee | Muted surface |
| `--muted-foreground` | `text-muted-foreground` | #525252 | Secondary text |
| `--accent` | `bg-accent` | #fbe5df | Soft coral fill |
| `--accent-foreground` | `text-accent-foreground` | #963422 | Text on accent |
| `--destructive` | `bg-destructive` | #c44a30 | Danger, deep coral |
| `--destructive-foreground` | `text-destructive-foreground` | #ffffff | Text on destructive |
| `--border` | `border-border` | #e4e1dc | Hairline borders |
| `--input` | `border-input` | #c9c5be | Strong borders, input border |
| `--ring` | `ring-ring` | #c44a30 | Focus ring |
| `--sidebar` | `bg-sidebar` | #1a1a1a | Sidebar background |
| `--sidebar-foreground` | `text-sidebar-foreground` | #a8a39d | Sidebar text |
| `--sidebar-primary` | `bg-sidebar-primary` | #e85d3f | Active marker |
| `--sidebar-accent` | `bg-sidebar-accent` | #2a2a2a | Sidebar hover |

### Custom domain tokens

Beyond the shadcn standard, these express product-specific semantics:

| Token | Utility | Value | Purpose |
|-------|---------|-------|---------|
| `--brand` | `bg-brand` / `text-brand` | #e85d3f | Signature coral accent |
| `--subtle-foreground` | `text-subtle-foreground` | #8a8580 | Tertiary text, labels |
| `--status-todo` | `var(--status-todo)` | #8a8580 | Workflow: todo |
| `--status-progress` | `var(--status-progress)` | #1a1a1a | Workflow: in progress |
| `--status-review` | `var(--status-review)` | #c44a30 | Workflow: review |
| `--status-done` | `var(--status-done)` | #525252 | Workflow: done |
| `--priority-low` | `var(--priority-low)` | #8a8580 | Priority: low |
| `--priority-medium` | `var(--priority-medium)` | #525252 | Priority: medium |
| `--priority-high` | `var(--priority-high)` | #c44a30 | Priority: high |
| `--priority-urgent` | `var(--priority-urgent)` | #8f2e20 | Priority: urgent |
| `--chart-1` through `--chart-5` | `var(--chart-*)` | various | Recharts palette |

Status and priority tokens are used in inline styles (`var(--status-todo)`) and in `@theme inline` for utility class generation.

## Typography

- **Headings:** Bricolage Grotesque (700, tracking -0.03em) — a contemporary grotesque with architectural character.
- **Body:** Spline Sans (400–600) — a neo-grotesque with precise, technical legibility that avoids the generic Inter/Geist convergence.
- **Mono:** JetBrains Mono (400–500) — for tabular figures, sheet numbers, and measured data.

All numeric data uses `font-variant-numeric: tabular-nums` via the `.tabular` utility. Body text uses `cv01` and `tnum` feature settings.

## Color

### Scarcity of color

A screen should read clearly in grayscale. Accent color marks action, state, or emphasis — it does not fill every component.

### Palette mapping

The binder palette maps to shadcn semantic tokens:

- **Vellum canvas** → `bg-background` (#faf9f7)
- **Elevated surface** → `bg-card` / `bg-popover` (#ffffff)
- **Sunken surface** → `bg-secondary` / `bg-muted` (#f4f2ee)
- **Ink** → `bg-primary` / `text-foreground` (#1a1a1a)
- **Secondary text** → `text-muted-foreground` (#525252)
- **Tertiary text** → `text-subtle-foreground` (#8a8580)
- **Coral signature** → `bg-brand` / `text-brand` (#e85d3f)
- **Soft coral** → `bg-accent` (#fbe5df)
- **Danger** → `bg-destructive` (#c44a30)
- **Hairline border** → `border-border` (#e4e1dc)
- **Strong border** → `border-input` (#c9c5be)
- **Focus ring** → `ring-ring` (#c44a30)
- **Sidebar** → `bg-sidebar` (#1a1a1a)

### Status and priority

Status and priority colors are domain tokens used in inline styles for data-driven colors (chart fills, status dots, priority indicators):

- **Status:** todo (`--status-todo` #8a8580), in_progress (`--status-progress` #1a1a1a), review (`--status-review` #c44a30), done (`--status-done` #525252)
- **Priority:** low (`--priority-low` #8a8580), medium (`--priority-medium` #525252), high (`--priority-high` #c44a30), urgent (`--priority-urgent` #8f2e20)

## Radius hierarchy

Square geometry throughout — a deliberate architectural choice, not global flattening:

| Radius | Value | Used for |
|--------|-------|----------|
| Square | 0px | Cards, panels, kanban cards, gantt bars, progress bars, badges, buttons, inputs, selects, table rows, filter chips, revenue bars |
| Circular | full | Avatars, status dots, priority dots, color indicators only |

`--radius: 0px` in `:root` controls all shadcn radius calculations (`--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl` all resolve to 0px).

## Elevation

Hairline borders carry structure. Shadows are reserved for surfaces that float above the work surface (dialogs, dropdowns, notification panels). Resting elements use tonal layering and borders, never shadows.

## Layout

### Shell
- **Sidebar:** Dark binder cover (`bg-sidebar`) with numbered sheet index (01–06), coral active marker (`bg-sidebar-primary`).
- **Topbar:** Elevated surface (`bg-card`) with `border-border` bottom, search, notifications, profile.
- **Content:** Vellum canvas (`bg-background`) with bounded 1280px frame and 32px section rhythm.

### Page composition (`src/components/page-layout.tsx`)
- **`TitleBlock`**: Route title, description, actions, and meta line — separated by a hairline bottom border (`border-border`).
- **`SheetSummary` / `SummaryMetric`**: Border-separated summary strip (no cards, no icon tiles). Grid with `divide-x divide-border border-y border-border`.
- **`ContentGrid`**: Two-column analytical layout collapsing at xl.
- **`Toolbar`**: Bordered (`border-border`), elevated (`bg-card`) control group.
- **`Section`**: Vertical rhythm container.

### Wide canvases
Projects board and Gantt timeline opt into wider canvases with explicit horizontal overflow, sticky identifiers, and minimum column widths. All other routes use the bounded frame.

## Components

### Cards / Panels
Square ruled panels with hairline border (`border-border`), elevated background (`bg-card`). No rounding, no shadow. Internal padding: 24px (p-6).

### Badges
Revision-label style: compact uppercase, tracked (`tracking-wider`), square. Semantic variants: `neutral`, `accent`, `positive`, `warning`, `danger`, `outline`. The API uses semantic names, not color names.

### Buttons
- **Primary (default):** `bg-primary text-primary-foreground`.
- **Outline:** `bg-card border-border`, tonal hover (`hover:bg-secondary`).
- **Accent:** `bg-brand text-white` for CP-specific emphasis.
- **Positive:** `bg-primary text-primary-foreground` for confirmed/positive states.
- **Destructive:** `bg-destructive text-destructive-foreground`.
- **Ghost:** Transparent, `hover:bg-secondary`.
- **Link:** `text-destructive underline-offset-4 hover:underline`.
- **Radius:** 0px (square). Minimum 40px height.

### Progress bars
Square, no rounding. Track is `bg-secondary`, fill is semantic color. Height 2px.

### Inputs / Selects
Square (0px radius), `border-border`, `bg-card`, 40px height. `ring-ring` 2px focus ring with offset. Reusable `Select` primitive in `src/components/ui/select.tsx`.

### Kanban cards
Square, `border-border`, `bg-card`. Hover changes border to `border-input` only (no lift, no scale). Drag state: `border-primary`, reduced opacity.

### Gantt bars
Square, flat color. Project duration bars at 20% opacity. Today marker is a 1px coral vertical line. No rounding on bars.

### Charts (Recharts)
- Tooltip: 0px radius, `border-border`, `shadow-md` (floating surface).
- Bar radius: 0 — square, not pill-shaped.
- Grid: dashed hairline (`var(--border)`), no vertical grid.
- Colors: `var(--primary)`, `var(--brand)`, `var(--muted-foreground)`, `var(--border)`.

### Revenue bars (Sales page)
Square track (`bg-secondary`) and fill, no rounding. Tabular figures for amounts.

### Navigation
Dark sidebar (`bg-sidebar`) with sheet numbers (01–06) in JetBrains Mono. Active state: `bg-sidebar-accent` row with `bg-sidebar-primary` left marker (3px bar). No filled pills, no rounded nav rows.

## Do's and Don'ts

### Do
- Let hairline borders, dividers, and tonal surfaces carry hierarchy.
- Use tabular figures for all numeric data.
- Use the coral accent sparingly for signature moments.
- Provide visible focus, keyboard access, reduced-motion alternatives, and 44px touch targets.
- Use SGD and en-SG formatting for financial and date information.
- Use shadcn semantic tokens (`bg-background`, `text-foreground`, `border-border`, etc.) for all styling.
- Run `npx shadcn@latest add <component>` to generate new primitives.
- Adapt generated components to square geometry before shipping.

### Don't
- Use gradients, icon tiles, or decorative hover lifts.
- Use `rounded-full` on anything except circular indicators (avatars, status dots).
- Use shadows on resting elements.
- Use `tracking-wide` — use `tracking-wider` for uppercase labels.
- Use raw color utilities (`bg-white`, `text-black`) in page components — use semantic tokens (`bg-card`, `text-foreground`).
- Mix icon families — Lucide is the only icon library.
- Introduce literal route-level colors or arbitrary radius values without a token.
- Make the internal tool read like a public marketing landing page.
