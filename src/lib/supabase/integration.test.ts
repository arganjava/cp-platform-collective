/**
 * Live integration tests against the real Supabase project.
 *
 * Two layers:
 *   1. Schema + RLS sanity (anonymous) — no credentials needed. Confirms the
 *      tables from supabase/setup.sql exist and that RLS hides them from the
 *      anon role. This is the fastest way to diagnose "the app loads but CRUD
 *      doesn't stick" (missing tables ⇒ setup.sql never ran; anon sees rows ⇒
 *      RLS disabled).
 *   2. Authenticated CRUD — signs in as the admin account and runs the app's
 *      real data layer (`src/lib/supabase/data.ts`) through full
 *      create → read → update → delete round-trips, exactly as the browser
 *      would experience them (schema, RLS, FK constraints included).
 *
 * Prereqs for layer 2 only:
 *   - NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (from
 *     .env.local / .env or the environment)
 *   - the admin user provisioned via supabase/admin-user.sql
 *     (or override with E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD)
 *
 * Run:  npm run test:integration
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { setSupabaseClientForTesting } from "./client";
import {
  deleteProjectRow,
  deleteSaleRow,
  deleteTaskRow,
  ensureProfile,
  fetchTeamData,
  insertNotification,
  insertProject,
  insertSale,
  insertTask,
  updateNotificationRow,
  updateProjectRow,
  updateSaleRow,
  updateTaskRow,
} from "./data";
import { generateId } from "../utils";
import type { Notification, Project, Sale, Task, User } from "../types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const adminEmail = process.env.E2E_ADMIN_EMAIL || "admin@collectivep.com";
const adminPassword = process.env.E2E_ADMIN_PASSWORD || "CPAdmin2026!";

const WORKSPACE_TABLES = ["profiles", "projects", "tasks", "sales", "notifications"] as const;

function requireEnv() {
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY — set them in .env.local or the environment."
    );
  }
}

describe("live Supabase integration (real project)", () => {
  describe("schema + RLS sanity (anonymous, no credentials)", () => {
    beforeAll(requireEnv);

    it("every workspace table exists and is empty for anonymous clients (RLS on)", async () => {
      const anon = createClient(url!, anonKey!, { auth: { persistSession: false } });
      for (const table of WORKSPACE_TABLES) {
        const { data, error } = await anon.from(table).select("*").limit(1);
        // Missing table ⇒ setup.sql was never run on this project.
        expect(error, `${table}: ${error?.message ?? ""}`).toBeNull();
        // RLS on + no anon policy ⇒ zero rows. If RLS is off, seed data leaks.
        expect(data, `${table} should be invisible to anonymous clients`).toHaveLength(0);
      }
    });
  });

  describe("authenticated CRUD (admin session)", () => {
    let client: SupabaseClient;
    let admin: User;

    beforeAll(async () => {
      requireEnv();
      client = createClient(url!, anonKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: signInError } = await client.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword,
      });
      if (signInError) {
        throw new Error(
          `Admin sign-in failed: ${signInError.message} — run (or re-run) supabase/admin-user.sql; it repairs an existing user in place (NULL token columns + the missing auth.identities row), and you can override creds with E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD.`
        );
      }
      const {
        data: { user },
        error: userError,
      } = await client.auth.getUser();
      if (userError || !user) {
        throw new Error(`Could not load the admin auth user: ${userError?.message}`);
      }
      setSupabaseClientForTesting(client);
      admin = await ensureProfile({
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
      });
    });

    afterAll(() => {
      setSupabaseClientForTesting(null);
    });

    function newProject(overrides: Partial<Project> = {}): Project {
      return {
        id: generateId(),
        title: `IT Project ${Date.now()}`,
        description: "Live integration test",
        status: "active",
        color: "var(--primary)",
        ownerId: admin.id,
        memberIds: [admin.id],
        startDate: "2026-08-01",
        endDate: "2026-08-31",
        createdAt: new Date().toISOString(),
        ...overrides,
      };
    }

    it("fetchTeamData loads the workspace and includes the signed-in admin", async () => {
      const data = await fetchTeamData();
      expect(Array.isArray(data.users)).toBe(true);
      expect(Array.isArray(data.projects)).toBe(true);
      expect(Array.isArray(data.tasks)).toBe(true);
      expect(Array.isArray(data.sales)).toBe(true);
      expect(Array.isArray(data.notifications)).toBe(true);
      expect(data.users.some((u) => u.id === admin.id)).toBe(true);
    });

    it("projects: create → read → update → delete round-trips", async () => {
      const project = newProject();
      try {
        await insertProject(project);

        let loaded = (await fetchTeamData()).projects.find((p) => p.id === project.id);
        expect(loaded).toMatchObject({
          title: project.title,
          status: "active",
          ownerId: admin.id,
          memberIds: [admin.id],
        });

        await updateProjectRow(project.id, {
          title: `${project.title} (updated)`,
          status: "completed",
          color: "var(--brand)",
        });
        loaded = (await fetchTeamData()).projects.find((p) => p.id === project.id);
        expect(loaded?.title).toBe(`${project.title} (updated)`);
        expect(loaded?.status).toBe("completed");
        expect(loaded?.color).toBe("var(--brand)");
      } finally {
        await deleteProjectRow(project.id).catch(() => {});
      }
      expect((await fetchTeamData()).projects.find((p) => p.id === project.id)).toBeUndefined();
    });

    it("tasks: create → read → update → delete round-trips against a project", async () => {
      const project = newProject({ title: `IT Task Host ${Date.now()}` });
      const task: Task = {
        id: generateId(),
        projectId: project.id,
        title: `IT Task ${Date.now()}`,
        description: "Live integration test",
        status: "todo",
        priority: "high",
        assigneeId: admin.id,
        startDate: "2026-08-01",
        dueDate: "2026-08-15",
        tags: ["integration"],
        createdAt: new Date().toISOString(),
        order: 0,
      };
      try {
        await insertProject(project);
        await insertTask(task);

        let loaded = (await fetchTeamData()).tasks.find((t) => t.id === task.id);
        expect(loaded).toMatchObject({
          projectId: project.id,
          status: "todo",
          priority: "high",
          assigneeId: admin.id,
          tags: ["integration"],
        });

        await updateTaskRow(task.id, { status: "in_progress", dueDate: "2026-08-20" });
        loaded = (await fetchTeamData()).tasks.find((t) => t.id === task.id);
        expect(loaded?.status).toBe("in_progress");
        expect(loaded?.dueDate).toBe("2026-08-20");
      } finally {
        await deleteTaskRow(task.id).catch(() => {});
        await deleteProjectRow(project.id).catch(() => {});
      }
      expect((await fetchTeamData()).tasks.find((t) => t.id === task.id)).toBeUndefined();
    });

    it("sales: create → read → update amount → delete round-trips", async () => {
      const project = newProject({ title: `IT Sale Host ${Date.now()}` });
      const sale: Sale = {
        id: generateId(),
        projectId: project.id,
        amount: 1250.5,
        clientName: `IT Client ${Date.now()}`,
        type: "commission",
        date: "2026-08-10",
        notes: "Live integration test",
        createdAt: new Date().toISOString(),
      };
      try {
        await insertProject(project);
        await insertSale(sale);

        let loaded = (await fetchTeamData()).sales.find((s) => s.id === sale.id);
        expect(loaded).toMatchObject({
          projectId: project.id,
          amount: 1250.5,
          type: "commission",
          clientName: sale.clientName,
        });

        await updateSaleRow(sale.id, { amount: 9999, type: "sponsorship" });
        loaded = (await fetchTeamData()).sales.find((s) => s.id === sale.id);
        expect(loaded?.amount).toBe(9999);
        expect(loaded?.type).toBe("sponsorship");
      } finally {
        await deleteSaleRow(sale.id).catch(() => {});
        await deleteProjectRow(project.id).catch(() => {});
      }
      expect((await fetchTeamData()).sales.find((s) => s.id === sale.id)).toBeUndefined();
    });

    it("notifications: insert → mark read", async () => {
      const notification: Notification = {
        id: generateId(),
        userId: admin.id,
        message: "Live integration test notification",
        type: "update",
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      try {
        await insertNotification(notification);
        await updateNotificationRow(notification.id, true);
        const loaded = (await fetchTeamData()).notifications.find(
          (n) => n.id === notification.id
        );
        expect(loaded?.isRead).toBe(true);
      } finally {
        // PostgrestBuilder is a thenable, not a Promise — use .then to swallow.
        await client
          .from("notifications")
          .delete()
          .eq("id", notification.id)
          .then(() => undefined, () => undefined);
      }
    });
  });
});
