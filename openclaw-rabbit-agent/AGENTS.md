# AGENTS.md — Rabbit Agent Architecture & Supabase CRM Cockpit Integration

## Overview & Runtime Environment
**Rabbit Agent** runs within the **OpenClaw** multi-agent runtime, acting as the intelligent mobile liaison between WhatsApp messaging hooks and the **Collective Perspectives (CP)** Supabase CRM backend.

```
WhatsApp User 📱 (CP Team Member / Manager / Artist)
       │ (Inbound WhatsApp message / voice-note transcript)
       ▼
OpenClaw Gateway / Rabbit Agent 🐇
       │ (Intent parsing, entity resolution & safety policy checks)
       ▼
Supabase CRM Database (PostgreSQL / PostgREST) 🗄️
  ├── public.profiles         (Team roster, roles & soft deletes)
  ├── public.clients          (Organizations, sponsors & commissioners)
  ├── public.projects         (Creative initiatives & deliverables)
  ├── public.project_profiles (Project team membership junction)
  ├── public.tasks            (Action items, milestone check dates & labeled links)
  ├── public.sales            (Revenue deals & pipeline entries)
  ├── public.sale_stages      (Stage progression history & PIC assignment)
  └── public.notifications    (System activity & assignment alerts)
       │ (Structured JSON responses)
       ▼
Rabbit Agent 🐇
       │ (Formats response with WhatsApp markdown & visual markers)
       ▼
WhatsApp User 📱 (Clean, scannable mobile response in SGT)
```

---

## Access Control & Operations Boundary
- **Allowed Operations**:
  - `READ`: Query lists, metrics, revenue summaries, record details, milestone status, and task assignments.
  - `CREATE`: Insert new tasks, projects, clients, sales deals, pipeline stages, and notifications.
  - `UPDATE`: Modify record fields (status, priority, due dates, check dates, links, assignees, deal amounts, stage progressions, notes).
- **Prohibited Operations**:
  - ❌ `DELETE`: Any `DELETE`, `TRUNCATE`, or `DROP` statement is strictly forbidden over WhatsApp. Attempted deletions must be intercepted and rejected with a helpful alternative (e.g., archiving projects, marking tasks as `done`, or progressing deals to `Lost`).

---

## CRM Cockpit Modules & Capabilities

The Collective Perspectives web cockpit is structured into core operational modules:

| Route | Cockpit Module | Purpose & Table Mapping |
| :--- | :--- | :--- |
| `/` | **Executive Dashboard** | High-level KPIs, active projects, pipeline funnel, revenue totals, upcoming milestones, recent team activity. |
| `/projects` | **Project Portfolio** | Creative exhibitions, workshops, and commissions. Tracks budget, status, timeline, and team roster via `project_profiles`. |
| `/tasks` | **Task Workspace** | Interactive list and Kanban boards. Features priority levels, due dates, **milestone check dates (🚩)**, and **multiple labeled links (JSONB)**. |
| `/gantt` | **Interactive Gantt** | Timeline and scheduling engine with milestone flags (`check_date`), dependency awareness, and direct resource links. |
| `/pipelines` & `/sales` | **Sales Pipeline** | Commercial deals and sponsorship tracker. Tracks progression through `Opportunity` ➔ `Discussion` ➔ `Closed` / `Lost` with PIC and value history in `sale_stages`. |
| `/clients` | **Client Directory** | Corporate partners, arts councils, and commissioners. Tracks relationship history, contacts, and linked deal revenue. |
| `/users` | **Team Roster** | Member management, avatar colors, contact info, and Role-Based Access Control (`admin`, `member`, `guest`). |
| `/reports` | **Impact & Finance Reports**| Revenue breakdowns in SGD, deal conversion rates, and project delivery progress. |

---

## Detailed Supabase Schema Specification

All UUIDs use standard RFC 4122 v4 strings. Schemas reflect all migrations up to `20260922000000_tasks_add_column_links_jsonb.sql`.

### 1. `public.profiles` (Team Roster & RBAC)
Stores team members, artists, coordinators, and administrators.
```sql
create table public.profiles (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique,
  name          text not null,
  email         text not null unique,
  avatar_color  text,
  role          text not null default 'guest', -- 'admin' | 'member' | 'guest'
  avatar_url    text,
  is_deleted    boolean default false,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now()
);
```
- **Functionality**:
  - `role`: Controls permissions. Workspace admins have full control; members manage assigned tasks and projects; guests have read-only or limited scope.
  - Soft Delete: Members are never hard-deleted. When removing a user, `is_deleted = true` and `deleted_at = now()` are set.
- **Agent Filter Directive**: Always filter active profiles with:
  ```sql
  deleted_at is null and (is_deleted is null or is_deleted = false)
  ```

---

### 2. `public.clients` (Organizations & Commercial Partners)
Stores corporate clients, institutional partners, and commissioners.
```sql
create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id) on delete set null
);
```
- **Functionality**: Normalized company registry. Referenced by `sales.client_id` to aggregate lifetime commercial value and active opportunities per partner.

---

### 3. `public.projects` (Creative Projects & Deliverables)
Tracks exhibitions, community workshops, brand partnerships, and studio initiatives.
```sql
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  status      text not null default 'active', -- 'active' | 'on_hold' | 'completed' | 'archived'
  color       text,
  owner_id    uuid references public.profiles (id) on delete set null,
  member_ids  uuid[] not null default '{}'::uuid[],
  start_date  date,
  end_date    date,
  created_at  timestamptz not null default now()
);
```
- **Functionality**: Groups deliverables, tasks, and sales.
- **Security Rule**: Enforced by RLS (`projects_delete_admin_only`), non-admin users cannot delete projects.

---

### 4. `public.project_profiles` (Project Membership Junction)
Manages multi-user assignment and access control for projects.
```sql
create table public.project_profiles (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint uq_project_profiles_project_profile unique (project_id, profile_id)
);
```
- **Functionality**: Allows assigning multiple members and guests to projects. Team members see projects they are assigned to via `project_profiles` or task assignments.
- **Indexes**: `idx_project_profiles_project` on `project_id`, `idx_project_profiles_profile` on `profile_id`.

---

### 5. `public.tasks` (Action Items & Task Kanban)
Actionable items nested inside projects.
```sql
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects (id) on delete cascade,
  title       text not null,
  description text not null default '',
  status      text not null default 'todo', -- 'todo' | 'in_progress' | 'review' | 'done'
  priority    text not null default 'medium', -- 'low' | 'medium' | 'high' | 'urgent'
  assignee_id uuid references public.profiles (id) on delete set null,
  start_date  date,
  due_date    date,
  check_date  date,                             -- Milestone check / review date (Flag 🚩)
  link        text,                             -- Legacy / fallback single URL
  links       jsonb not null default '[]'::jsonb, -- Multiple labeled links array
  tags        text[] not null default '{}'::text[],
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
```
- **Functionality**:
  - `check_date`: Optional milestone checkpoint date (visualized with a blue flag 🚩 in the Cockpit and Gantt view). Used for pre-deadline audits, framing checks, or client review sessions.
  - `links` (JSONB): Array of objects representing labeled external resources:
    ```json
    [
      { "id": "link-1", "label": "Figma Mockup", "url": "https://figma.com/file/..." },
      { "id": "link-2", "label": "Design Brief", "url": "https://docs.google.com/..." }
    ]
    ```
    - Managed atomically with the task record.
    - Indexed via GIN index: `idx_tasks_links`.
  - `link` (text): Maintained for backwards compatibility and synchronized with the first entry of `links`.

---

### 6. `public.sales` (Pipeline Deals & Revenue Records)
Commercial opportunities and confirmed revenue in Singapore Dollars (SGD).
```sql
create table public.sales (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects (id) on delete cascade,
  amount      numeric(12, 2) not null default 0,
  client_id   uuid references public.clients (id) on delete set null,
  type        text not null default 'commission', -- 'commission' | 'artwork' | 'workshop' | 'sponsorship' | 'grant'
  date        date,
  notes       text not null default '',
  created_at  timestamptz not null default now()
);
```
- **Functionality**: Records monetary value, client reference, deal category, and associated project.

---

### 7. `public.sale_stages` (Pipeline Stage History)
Historical audit trail of pipeline progression.
```sql
create table public.sale_stages (
  id              uuid primary key default gen_random_uuid(),
  sale_id         uuid not null references public.sales (id) on delete cascade,
  status          text not null check (status in ('Opportunity', 'Discussion', 'Closed', 'Lost')),
  date            timestamptz not null default now(),
  pic_profile_id  uuid references public.profiles (id) on delete set null,
  value           numeric(12, 2) not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id) on delete set null,
  updated_by      uuid references public.profiles (id) on delete set null
);
```
- **Functionality**:
  - Every stage change inserts a new record into `public.sale_stages`.
  - `status`: Deal state (`Opportunity`, `Discussion`, `Closed`, `Lost`).
  - `pic_profile_id`: Person in Charge for this stage.
  - `value`: Active valuation at this progression milestone.
- **Current Status Determination**: The current stage status of a deal is derived from the **latest record** ordered by `created_at desc limit 1`.

---

### 8. `public.notifications` (Activity Alerts & Assignments)
System notifications and assignment alerts.
```sql
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete cascade,
  message    text not null,
  type       text not null default 'update', -- 'assignment' | 'update' | 'deadline' | 'mention' | 'comment'
  is_read    boolean not null default false,
  related_id uuid,
  created_at timestamptz not null default now()
);
```

#### Automated Triggers & Email Webhook Flow:
1. **Task Assignment Trigger (`tr_task_assignment_notification` on `public.tasks`)**:
   - Whenever a task is **created** with an `assignee_id`, or **updated** with a new `assignee_id`:
   - A trigger automatically inserts a record into `public.notifications` with `user_id = assignee_id`, `type = 'assignment'`, `related_id = task.id`, and formatted message:
     `You have been assigned to task: "[Task Title]" in project "[Project Title]"`
2. **Webhook Listener Trigger (`tr_notifications_webhook_listener` on `public.notifications`)**:
   - Upon insert into `public.notifications`, an automated trigger retrieves the recipient's email and name from `public.profiles` (`where id = NEW.user_id`).
   - Inserts a pending tracking row into `public.notification_webhook_logs`.
   - Reads `BASE_URL` and `SERVICE_ROLE_KEY` directly from `public.app_config`:
     ```sql
     -- public.app_config stores key-value pairs:
     -- key = 'BASE_URL',         value = 'https://<your-project-ref>.supabase.co'
     -- key = 'SERVICE_ROLE_KEY', value = 'eyJhbGciOi...'
     -- key = 'RESEND_API_KEY',   value = 're_123456789...'
     ```
   - Automatically appends `/functions/v1/send-notification-email` and dispatches an asynchronous HTTP POST webhook via `pg_net` (`extensions.http_post`).
3. **Audit Log Table (`public.notification_webhook_logs`)**:
   ```sql
   create table public.notification_webhook_logs (
     id               uuid primary key default gen_random_uuid(),
     notification_id  uuid references public.notifications (id) on delete cascade,
     user_id          uuid references public.profiles (id) on delete set null,
     recipient_email  text,
     status           text not null default 'pending', -- 'pending' | 'sent' | 'failed' | 'simulated'
     payload          jsonb,
     response_code    integer,
     response_body    text,
     error_message    text,
     created_at       timestamptz not null default now(),
     updated_at       timestamptz not null default now()
   );
   ```
4. **Supabase Edge Function (`send-notification-email`)**:
   - Path: `supabase/functions/send-notification-email/index.ts`
   - Also mirrored in Next.js API route: `src/app/api/notifications/webhook/route.ts`
   - Fetches `RESEND_API_KEY` from `public.app_config` (falling back to environment variable if not present).
   - Fetches rich task details (due date, milestone check date, project title, labeled links).
   - Generates high-contrast branded HTML email for Collective Perspectives.
   - Dispatches email via Resend (`RESEND_API_KEY`) to `profiles.email` (or runs simulated dispatch with logging in local/test environments).
   - Updates `notification_webhook_logs` status to `sent` or `failed`.

---

## Integration Methods & API Patterns

OpenClaw connects to Supabase via standard **PostgREST HTTP API** or direct **PostgreSQL client**.

### Required Environment Configuration
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...  # For server-side backend agent
SUPABASE_ANON_KEY=eyJhbGciOi...          # Optional for client queries
```

### Headers for PostgREST Requests
```http
apikey: ${SUPABASE_SERVICE_ROLE_KEY}
Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}
Content-Type: application/json
Prefer: return=representation
```

---

## Standard PostgREST & SQL Query Patterns

### 1. READ: List Open Tasks with Check Dates, Labeled Links & Assignee
```http
GET /rest/v1/tasks?select=id,title,status,priority,due_date,check_date,links,project:project_id(title),assignee:assignee_id(name)&status=neq.done&order=due_date.asc.nullslast&limit=15
```
SQL equivalent:
```sql
select 
  t.id, 
  t.title, 
  t.status, 
  t.priority, 
  t.due_date, 
  t.check_date,
  t.links,
  p.title as project_title, 
  pr.name as assignee_name
from public.tasks t
left join public.projects p on t.project_id = p.id
left join public.profiles pr on t.assignee_id = pr.id
where t.status != 'done'
order by t.due_date asc nulls last
limit 15;
```

### 2. CREATE: Add New Task with Milestone Check Date and Multiple Labeled Links
```http
POST /rest/v1/tasks
{
  "title": "Prepare framing quote and canvas mount",
  "project_id": "8f3b2075-8025-4c60-a2d0-e17f7b244793",
  "assignee_id": "41a12345-0000-0000-0000-000000000001",
  "status": "todo",
  "priority": "high",
  "due_date": "2026-09-28",
  "check_date": "2026-09-25",
  "link": "https://figma.com/file/framing-specs",
  "links": [
    { "id": "link-1", "label": "Figma Specs", "url": "https://figma.com/file/framing-specs" },
    { "id": "link-2", "label": "Supplier Quote Doc", "url": "https://docs.google.com/document/d/123" }
  ]
}
```

### 3. UPDATE: Progress Task Status & Append Resource Link
```http
PATCH /rest/v1/tasks?id=eq.7e92bb19-482a-43c3-8f64-88f57ad19623
{
  "status": "in_progress",
  "links": [
    { "id": "link-1", "label": "PR Draft", "url": "https://github.com/org/repo/pull/42" }
  ]
}
```

### 4. READ: Active Sales Pipeline with Latest Stage and PIC
```sql
select 
  s.id, 
  s.amount, 
  s.type, 
  s.date,
  c.name as client_name,
  p.title as project_title,
  st.status as stage_status,
  st.value as stage_value,
  pic.name as pic_name
from public.sales s
left join public.clients c on s.client_id = c.id
left join public.projects p on s.project_id = p.id
left join lateral (
  select status, value, pic_profile_id, created_at
  from public.sale_stages
  where sale_id = s.id
  order by created_at desc
  limit 1
) st on true
left join public.profiles pic on st.pic_profile_id = pic.id
order by s.created_at desc;
```

### 5. CREATE: New Commercial Opportunity with Client Resolution & Initial Stage
When a WhatsApp user states:
*"Log a $30,000 corporate exhibition deal with Marina Bay Sands for Art Showcase 2026, stage Discussion, PIC Sarah"*:

1. Resolve or auto-create client:
   ```sql
   insert into public.clients (name) 
   values ('Marina Bay Sands') 
   on conflict (name) do update set updated_at = now() 
   returning id;
   ```
2. Insert sale:
   ```sql
   insert into public.sales (project_id, amount, client_id, type, notes)
   values ('<project_id>', 30000, '<client_id>', 'exhibition', 'Art Showcase 2026')
   returning id;
   ```
3. Insert initial stage:
   ```sql
   insert into public.sale_stages (sale_id, status, value, pic_profile_id, date)
   values ('<sale_id>', 'Discussion', 30000, '<sarah_profile_id>', now());
   ```

### 6. UPDATE: Advance Pipeline Stage
```sql
insert into public.sale_stages (sale_id, status, value, pic_profile_id, date)
values ('<sale_id>', 'Closed', 30000, '<sarah_profile_id>', now());
```

---

## Entity Resolution Guidelines for Natural Language
When interacting over WhatsApp:
- **People / Team Members**: Match against `profiles.name` using case-insensitive partial match (`ILIKE '%name%'`), filtering out soft-deleted users (`is_deleted = false`).
- **Clients**: Match against `clients.name`. If no exact match is found, propose auto-creating it.
- **Projects**: Match against `projects.title`. If multiple matches exist, provide a short numbered selection list.
- **Tasks**: Search open tasks by title substring within the active project context.

---

## Safety Guardrail Implementation in OpenClaw

OpenClaw execution handlers must enforce a strict programmatic block against destructive operations:

```javascript
// OpenClaw safety interceptor
function beforeExecuteTool(toolName, params) {
  const blockedKeywords = ['delete', 'destroy', 'drop', 'truncate', 'remove'];
  
  if (toolName.toLowerCase().includes('delete') || 
      blockedKeywords.some(kw => JSON.stringify(params).toLowerCase().includes(kw))) {
    throw new Error("DELETION_DISABLED_OVER_WHATSAPP");
  }
}
```
If triggered, Rabbit Agent immediately outputs the standard refusal and safe transition advice defined in `SOUL.md`.
