# AGENTS.md — Rabbit Agent Architecture & Supabase CRM Integration

## Overview & Runtime Environment
**Rabbit Agent** runs within the **OpenClaw** multi-agent runtime, interfacing between WhatsApp message hooks and the **Collective Perspectives (CP)** Supabase backend.

```
WhatsApp User 📱
       │ (Inbound message)
       ▼
OpenClaw Gateway / Rabbit Agent 🐇
       │ (Intent parsing, entity resolution & authorization)
       ▼
Supabase CRM Database (PostgreSQL / PostgREST) 🗄️
  [profiles, clients, projects, tasks, sales, sale_stages, notifications]
       │ (JSON responses)
       ▼
Rabbit Agent 🐇
       │ (Formats response with WhatsApp markdown)
       ▼
WhatsApp User 📱 (Structured response)
```

---

## Access Control & Operations Boundary
- **Allowed Operations**:
  - `READ`: Query lists, metrics, summaries, record details, status checks.
  - `CREATE`: Insert new tasks, projects, clients, sales deals, pipeline stages, notifications.
  - `UPDATE`: Modify fields (status, priority, dates, assignees, deal amounts, stage progressions, notes).
- **Prohibited Operations**:
  - ❌ `DELETE`: Any `DELETE`, `TRUNCATE`, or `DROP` statement is strictly forbidden. Attempted deletions must be intercepted and rejected with a helpful alternative (such as status updates).

---

## Supabase Schema Specification
The schema is sourced directly from `supabase/migrations/`. All UUIDs use standard RFC 4122 v4 strings.

### 1. `public.profiles` (Team Roster)
Stores team members, artists, coordinators, and administrators.
```sql
create table public.profiles (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique,
  name          text not null,
  email         text not null,
  avatar_color  text,
  role          text not null default 'guest', -- 'admin' | 'member' | 'guest'
  avatar_url    text,
  is_deleted    boolean default false,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now()
);
```
> **Filter Note**: Always filter active profiles with:
> `deleted_at is null and (is_deleted is null or is_deleted = false)`

### 2. `public.clients` (Organizations & Partners)
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

### 3. `public.projects` (Creative Projects & Deliverables)
Tracks exhibitions, workshops, brand partnerships, and community initiatives.
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

### 4. `public.tasks` (Action Items & Task Kanban)
Actionable deliverables nested inside projects.
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
  tags        text[] not null default '{}'::text[],
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
```

### 5. `public.sales` (Pipeline Deals & Revenue Records)
Financial pipeline records linked to clients and projects.
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

### 6. `public.sale_stages` (Pipeline Stage History)
Progression events tracking deals from opportunity to close.
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
> **Current Status Rule**: The "Stage Status" of a pipeline deal is derived from the **latest record** in `sale_stages` ordered by `created_at desc limit 1`.

### 7. `public.notifications` (Activity Alerts)
System alerts and team notifications.
```sql
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete cascade,
  message    text not null,
  type       text not null default 'update',
  is_read    boolean not null default false,
  related_id uuid,
  created_at timestamptz not null default now()
);
```

---

## Integration Methods & API Patterns

OpenClaw can connect to Supabase via standard **PostgREST HTTP API** or direct **PostgreSQL client**.

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

## Common Query Patterns (Create, Read, Update)

### 1. READ: List Tasks with Assignee & Project Details
```http
GET /rest/v1/tasks?select=id,title,status,priority,due_date,project:project_id(title),assignee:assignee_id(name)&order=due_date.asc.nullslast&limit=15
```
Or via SQL:
```sql
select t.id, t.title, t.status, t.priority, t.due_date, 
       p.title as project_title, pr.name as assignee_name
from public.tasks t
left join public.projects p on t.project_id = p.id
left join public.profiles pr on t.assignee_id = pr.id
where t.status != 'done'
order by t.due_date asc nulls last
limit 15;
```

### 2. READ: Pipeline Summary with Latest Stage & Client
```sql
select s.id, s.amount, s.type, s.date,
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

### 3. CREATE: Add New Task
```http
POST /rest/v1/tasks
{
  "title": "Prepare artwork framing for Singtel Gallery",
  "project_id": "8f3b2075-8025-4c60-a2d0-e17f7b244793",
  "assignee_id": "41a12345-0000-0000-0000-000000000001",
  "status": "todo",
  "priority": "high",
  "due_date": "2026-09-15"
}
```

### 4. UPDATE: Mark Task Completed
```http
PATCH /rest/v1/tasks?id=eq.7e92bb19-482a-43c3-8f64-88f57ad19623
{
  "status": "done"
}
```

### 5. CREATE: Log Client & Pipeline Deal with Initial Stage
When a user says: *"Log a new pipeline deal with DBS Bank, $25,000 for National Day Workshop, stage Discussion, PIC Sarah"*:

1. Check if client "DBS Bank" exists:
   ```sql
   select id, name from public.clients where lower(name) = lower('DBS Bank') limit 1;
   ```
2. If not found, insert into `public.clients`:
   ```sql
   insert into public.clients (name) values ('DBS Bank') returning id;
   ```
3. Insert into `public.sales`:
   ```sql
   insert into public.sales (project_id, amount, client_id, type, notes)
   values ('<project_id>', 25000, '<client_id>', 'workshop', 'National Day Workshop')
   returning id;
   ```
4. Insert into `public.sale_stages`:
   ```sql
   insert into public.sale_stages (sale_id, status, value, pic_profile_id, date)
   values ('<sale_id>', 'Discussion', 25000, '<sarah_profile_id>', now());
   ```

### 6. UPDATE: Progress Pipeline Stage
When advancing an existing deal:
```sql
insert into public.sale_stages (sale_id, status, value, pic_profile_id, date)
values ('<sale_id>', 'Closed', 25000, '<pic_id>', now());
```

---

## Entity Resolution Guidelines
When a user refers to entities by natural language in WhatsApp:
- **People**: Match against `profiles.name` using case-insensitive partial match (`ILIKE '%name%'`).
- **Clients**: Match against `clients.name`. If no match is found, prompt the user or offer to auto-create it.
- **Projects**: Match against `projects.title`. If ambiguous, list the top 2-3 matches with buttons or numbered list.
- **Tasks**: Search by title substring among open tasks for that project or assignee.

---

## Safety Guardrail Implementation in OpenClaw
OpenClaw execution handlers MUST include a hard filter intercepting any mutation intent:

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
If this exception triggers, Rabbit Agent responds with the standard refusal message defined in `SOUL.md`.
