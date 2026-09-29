// Supabase Edge Function: send-notification-email
// Location: supabase/functions/send-notification-email/index.ts
//
// Triggered by Database Webhook or direct API call when a notification is created.
// Supports sending notifications to a single recipient OR multiple recipients.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface NotificationRecord {
  id?: string;
  user_id?: string;
  message?: string;
  type?: string;
  is_read?: boolean;
  related_id?: string | null;
  created_at?: string;
  recipient?: { name?: string; email?: string };
}

interface RecipientInput {
  name?: string;
  email?: string;
  user_id?: string;
  notification_id?: string;
  message?: string;
}

interface WebhookPayload {
  type?: string;
  table?: string;
  schema?: string;
  record?: NotificationRecord;
  records?: NotificationRecord[];
  notification?: NotificationRecord;
  notifications?: NotificationRecord[];
  recipient?: RecipientInput;
  recipients?: RecipientInput[];
  notification_id?: string;
  notification_ids?: string[];
  user_id?: string;
  user_ids?: string[];
  recipient_emails?: string[];
  message?: string;
  related_id?: string | null;
  task_id?: string | null;
  all_assignees?: boolean;
}

interface TaskDetails {
  title?: string;
  priority?: string;
  due_date?: string | null;
  check_date?: string | null;
  check_start_time?: string | null;
  check_end_time?: string | null;
  project_title?: string | null;
  links?: Array<{ label?: string; url?: string }>;
}

interface ResolvedRecipient {
  userId?: string;
  email: string;
  name: string;
  notificationId?: string;
  message?: string;
}

interface CalendarSyncResult {
  status: "created" | "updated" | "skipped" | "failed";
  calendarEventId?: string | null;
  error?: string;
}

/**
 * Pustaka Google Auth khusus untuk runtime Deno / Edge.
 * Menginisialisasi autentikasi Google JWT Service Account dan mendapatkan token akses yang valid secara otomatis.
 */
export class GoogleAuth {
  private scope: string[];
  private credentials: {
    client_email?: string;
    private_key?: string;
  };

  constructor(options: {
    scope?: string[];
    credentials: { client_email?: string; private_key?: string };
  }) {
    this.scope = options.scope || ["https://www.googleapis.com/auth/calendar"];
    this.credentials = options.credentials;
  }

  async getToken(): Promise<string> {
    if (!this.credentials?.client_email || !this.credentials?.private_key) {
      throw new Error("Missing client_email or private_key in service account credentials");
    }

    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;

    const header = { alg: "RS256", typ: "JWT" };
    const claims = {
      iss: this.credentials.client_email,
      scope: this.scope.join(" "),
      aud: "https://oauth2.googleapis.com/token",
      exp,
      iat,
    };

    const enc = new TextEncoder();
    const b64Url = (bytes: Uint8Array) => {
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    };

    const headerB64 = b64Url(enc.encode(JSON.stringify(header)));
    const claimsB64 = b64Url(enc.encode(JSON.stringify(claims)));
    const signingInput = `${headerB64}.${claimsB64}`;

    // Normalisasi private key (baik dengan newline asli maupun newline ter-escape)
    const rawKey = this.credentials.private_key.replace(/\\n/g, "\n");
    const cleanPem = rawKey
      .replace(/-----BEGIN [A-Z ]+-----/g, "")
      .replace(/-----END [A-Z ]+-----/g, "")
      .replace(/\s+/g, "");

    const binaryDer = Uint8Array.from(atob(cleanPem), (c) => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      binaryDer.buffer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      enc.encode(signingInput)
    );

    const signatureB64 = b64Url(new Uint8Array(signatureBuffer));
    const jwt = `${signingInput}.${signatureB64}`;

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new Error(`Google token exchange failed (${tokenResponse.status}): ${errText}`);
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  }
}

/**
 * Creates or updates a Google Calendar event for a given task ID.
 * Menggunakan GoogleAuth dengan credentials dari app_config (key = GOOGLE_SERVICE_ACCOUNT_KEY).
 */
async function syncTaskWithGoogleCalendar(
  supabaseAdmin: any,
  taskId: string,
  appUrl: string
): Promise<CalendarSyncResult> {
  // 1. Ambil Service Account Key dari public.app_config (fallback ke Deno.env)
  const { data: configRow } = await supabaseAdmin
    .from("app_config")
    .select("value")
    .eq("key", "GOOGLE_SERVICE_ACCOUNT_KEY")
    .maybeSingle();

  const serviceAccountKeyString = configRow?.value || Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
  if (!serviceAccountKeyString) {
    console.log("[Google Calendar] Skipped: GOOGLE_SERVICE_ACCOUNT_KEY not set in app_config.");
    return { status: "skipped", error: "GOOGLE_SERVICE_ACCOUNT_KEY not configured" };
  }

  let credentials: { client_email?: string; private_key?: string };
  try {
    credentials = typeof serviceAccountKeyString === "string"
      ? JSON.parse(serviceAccountKeyString)
      : serviceAccountKeyString;
  } catch (parseErr) {
    console.warn("[Google Calendar] Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY JSON:", parseErr);
    return { status: "failed", error: "Invalid GOOGLE_SERVICE_ACCOUNT_KEY JSON" };
  }

  if (!credentials?.client_email || !credentials?.private_key) {
    console.warn("[Google Calendar] Service account missing client_email or private_key");
    return { status: "failed", error: "Missing client_email or private_key in service account credentials" };
  }

  // 2. Fetch task, project, and assignees
  const { data: task, error: taskError } = await supabaseAdmin
    .from("tasks")
    .select("id, title, description, status, priority, due_date, check_date, check_start_time, check_end_time, google_calendar_id, project_id, assignee_id, project:project_id(title)")
    .eq("id", taskId)
    .maybeSingle();

  if (taskError || !task) {
    console.warn("[Google Calendar] Could not find task with id:", taskId, taskError);
    return { status: "skipped", error: "Task not found" };
  }

  // 3. Query all task_profiles and task.assignee_id to collect attendee emails
  const { data: taskProfileRows } = await supabaseAdmin
    .from("task_profiles")
    .select("profile_id")
    .eq("task_id", taskId);

  const profileIds = new Set<string>();
  if (task.assignee_id) profileIds.add(task.assignee_id);
  if (Array.isArray(taskProfileRows)) {
    for (const tp of taskProfileRows) {
      if (tp.profile_id) profileIds.add(tp.profile_id);
    }
  }

  const attendeeList: Array<{ email: string }> = [];
  if (profileIds.size > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("email, is_deleted, deleted_at")
      .in("id", Array.from(profileIds));

    if (profiles) {
      for (const p of profiles) {
        if (p.email && !p.is_deleted && !p.deleted_at) {
          const trimmed = p.email.trim();
          if (trimmed && !attendeeList.some((a) => a.email.toLowerCase() === trimmed.toLowerCase())) {
            attendeeList.push({ email: trimmed });
          }
        }
      }
    }
  }

  // 4. Build start and end timings
  const timeZone = "Asia/Singapore";
  let startObj: { dateTime?: string; date?: string; timeZone?: string };
  let endObj: { dateTime?: string; date?: string; timeZone?: string };

  if (task.check_start_time) {
    const startDate = new Date(task.check_start_time);
    const startIso = isNaN(startDate.getTime())
      ? `${String(task.check_start_time).split("T")[0]}T09:00:00+08:00`
      : startDate.toISOString();

    let endIso: string;
    if (task.check_end_time) {
      const endDate = new Date(task.check_end_time);
      endIso = isNaN(endDate.getTime())
        ? `${String(task.check_end_time).split("T")[0]}T10:00:00+08:00`
        : endDate.toISOString();
    } else {
      endIso = new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString();
    }
    startObj = { dateTime: startIso, timeZone };
    endObj = { dateTime: endIso, timeZone };
  } else if (task.check_date) {
    startObj = { dateTime: `${task.check_date}T09:00:00+08:00`, timeZone };
    endObj = { dateTime: `${task.check_date}T10:00:00+08:00`, timeZone };
  } else if (task.due_date) {
    startObj = { dateTime: `${task.due_date}T09:00:00+08:00`, timeZone };
    endObj = { dateTime: `${task.due_date}T10:00:00+08:00`, timeZone };
  } else {
    const today = new Date().toISOString().split("T")[0];
    startObj = { dateTime: `${today}T09:00:00+08:00`, timeZone };
    endObj = { dateTime: `${today}T10:00:00+08:00`, timeZone };
  }

  // 5. Build Event Title and Description
  const projTitle = (task.project as { title?: string } | null)?.title || null;
  const eventSummary = projTitle ? `[${projTitle}] ${task.title}` : task.title;

  const descParts: string[] = [];
  if (task.description) descParts.push(task.description);
  descParts.push("");
  if (projTitle) descParts.push(`Project: ${projTitle}`);
  if (task.priority) descParts.push(`Priority: ${task.priority.toUpperCase()}`);
  if (task.status) descParts.push(`Status: ${task.status}`);
  if (task.check_date) descParts.push(`🚩 Milestone Check Date: ${task.check_date}`);
  if (task.check_start_time) descParts.push(`Check Start: ${task.check_start_time}`);
  if (task.check_end_time) descParts.push(`Check End: ${task.check_end_time}`);
  if (task.due_date) descParts.push(`Due Date: ${task.due_date}`);
  descParts.push(`Link: ${appUrl}/tasks`);
  const eventDescription = descParts.join("\n");

  const eventPayload: Record<string, any> = {
    summary: eventSummary,
    description: eventDescription,
    start: startObj,
    end: endObj,
  };

  if (attendeeList.length > 0) {
    eventPayload.attendees = attendeeList;
  }

  // 6. Inisialisasi Autentikasi Google JWT
  const auth = new GoogleAuth({
    scope: ["https://www.googleapis.com/auth/calendar"],
    credentials,
  });

  // Mendapatkan token akses yang valid secara otomatis
  const token = await auth.getToken();

  // 7. Panggil HTTP REST API Google Calendar langsung
  const calendarId = "primary";
  let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  let method = "POST";

  // Jika operasinya adalah UPDATE, sesuaikan URL dan Method HTTP
  if (task.google_calendar_id) {
    url = `${url}/${encodeURIComponent(task.google_calendar_id)}`;
    method = "PUT";
  }

  try {
    const response = await fetch(`${url}?sendUpdates=all`, {
      method,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventPayload),
    });

    const result = await response.json();

    if (response.ok) {
      const eventId = result.id || task.google_calendar_id;
      if (!task.google_calendar_id && result.id) {
        await supabaseAdmin
          .from("tasks")
          .update({ google_calendar_id: result.id })
          .eq("id", taskId);
        console.log(`[Google Calendar] Created event ${result.id} and linked to task ${taskId}`);
      } else {
        console.log(`[Google Calendar] Updated event ${eventId} for task ${taskId}`);
      }
      return {
        status: method === "PUT" ? "updated" : "created",
        calendarEventId: eventId,
      };
    }

    // Jika update menghasilkan 404 (event dihapus di calendar), create ulang
    if (method === "PUT" && response.status === 404) {
      console.log(`[Google Calendar] Event ${task.google_calendar_id} not found on calendar. Recreating...`);
      const createUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`;
      const createRes = await fetch(createUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventPayload),
      });
      const createResult = await createRes.json();
      if (createRes.ok && createResult.id) {
        await supabaseAdmin
          .from("tasks")
          .update({ google_calendar_id: createResult.id })
          .eq("id", taskId);
        return { status: "created", calendarEventId: createResult.id };
      }
    }

    const errDetail = typeof result === "object" ? JSON.stringify(result) : String(result);
    console.warn(`[Google Calendar] Calendar API returned error (${response.status}):`, errDetail);
    return { status: "failed", error: errDetail };
  } catch (calError: any) {
    console.warn("[Google Calendar] Error calling Google Calendar API:", calError);
    return { status: "failed", error: calError?.message || String(calError) };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const appUrl = Deno.env.get("APP_URL") || "https://cockpit.collectivep.com";
    let resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("NOTIFICATION_FROM_EMAIL") || "Collective Perspectives <notifications@collectivep.com>";

    const body: WebhookPayload = await req.json().catch(() => ({}));

    let supabaseAdmin = null;
    if (supabaseUrl && supabaseServiceKey) {
      supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }

    // Attempt to load RESEND_API_KEY from public.app_config if configured
    if (supabaseAdmin) {
      try {
        const { data: configData } = await supabaseAdmin
          .from("app_config")
          .select("value")
          .eq("key", "RESEND_API_KEY")
          .maybeSingle();

        if (configData?.value) {
          resendApiKey = configData.value;
        }
      } catch (err) {
        console.warn("Could not retrieve RESEND_API_KEY from app_config:", err);
      }
    }

    // 1. Gather all potential recipient entries from various multi/single payload formats
    const rawItems: Array<{
      userId?: string;
      email?: string;
      name?: string;
      notificationId?: string;
      message?: string;
    }> = [];

    // Handle batch records array
    const recordsList = body.records || body.notifications;
    if (Array.isArray(recordsList) && recordsList.length > 0) {
      for (const rec of recordsList) {
        rawItems.push({
          userId: rec.user_id,
          notificationId: rec.id,
          message: rec.message,
          email: rec.recipient?.email,
          name: rec.recipient?.name,
        });
      }
    }

    // Handle explicit recipients array
    if (Array.isArray(body.recipients) && body.recipients.length > 0) {
      for (const rec of body.recipients) {
        rawItems.push({
          userId: rec.user_id,
          email: rec.email,
          name: rec.name,
          notificationId: rec.notification_id,
          message: rec.message,
        });
      }
    }

    // Handle user_ids array
    if (Array.isArray(body.user_ids) && body.user_ids.length > 0) {
      for (const uid of body.user_ids) {
        rawItems.push({ userId: uid });
      }
    }

    // Handle recipient_emails array
    if (Array.isArray(body.recipient_emails) && body.recipient_emails.length > 0) {
      for (const em of body.recipient_emails) {
        rawItems.push({ email: em });
      }
    }

    // Handle single record/notification format
    const singleRecord = body.record || body.notification;
    if (singleRecord || body.notification_id || body.user_id || body.recipient) {
      rawItems.push({
        userId: singleRecord?.user_id || body.user_id,
        notificationId: singleRecord?.id || body.notification_id,
        message: singleRecord?.message || body.message,
        email: body.recipient?.email,
        name: body.recipient?.name,
      });
    }

    const defaultMessage = body.message || singleRecord?.message || "You have a new update in Collective Perspectives.";
    const relatedId = body.related_id || body.task_id || singleRecord?.related_id || null;
    const notifType = singleRecord?.type || "assignment";

    // If related task is present and all_assignees is requested (or no recipients specified)
    if (supabaseAdmin && relatedId && (body.all_assignees || rawItems.length === 0)) {
      try {
        const { data: taskData } = await supabaseAdmin
          .from("tasks")
          .select("assignee_id")
          .eq("id", relatedId)
          .maybeSingle();

        const { data: profileRows } = await supabaseAdmin
          .from("task_profiles")
          .select("profile_id")
          .eq("task_id", relatedId);

        if (taskData?.assignee_id) {
          rawItems.push({ userId: taskData.assignee_id });
        }
        if (Array.isArray(profileRows)) {
          for (const tp of profileRows) {
            if (tp.profile_id) rawItems.push({ userId: tp.profile_id });
          }
        }
      } catch (e) {
        console.warn("Could not query assignees for task:", e);
      }
    }

    // Validate that we have at least one recipient identifier
    if (rawItems.length === 0) {
      return new Response(
        JSON.stringify({ error: "user_id is required (or provide recipients list)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Resolve missing emails/names from profiles
    const userIdsToFetch = Array.from(
      new Set(rawItems.filter((i) => i.userId && !i.email).map((i) => i.userId!))
    );

    const profileMap = new Map<string, { email: string; name: string; is_deleted?: boolean; deleted_at?: string | null }>();

    if (supabaseAdmin && userIdsToFetch.length > 0) {
      const { data: profiles, error: profileErr } = await supabaseAdmin
        .from("profiles")
        .select("id, name, email, is_deleted, deleted_at")
        .in("id", userIdsToFetch);

      if (profileErr) {
        console.error("Error fetching profiles:", profileErr);
      } else if (profiles) {
        for (const p of profiles) {
          profileMap.set(p.id, {
            email: p.email,
            name: p.name,
            is_deleted: p.is_deleted,
            deleted_at: p.deleted_at,
          });
        }
      }
    }

    // Build unique list of resolved recipients
    const resolvedRecipients: ResolvedRecipient[] = [];
    const seenEmails = new Set<string>();

    for (const item of rawItems) {
      let email = item.email;
      let name = item.name || "Team Member";

      if (item.userId && profileMap.has(item.userId)) {
        const p = profileMap.get(item.userId)!;
        if (p.is_deleted || p.deleted_at) {
          continue; // skip soft-deleted users
        }
        email = email || p.email;
        name = name !== "Team Member" ? name : p.name || name;
      }

      if (email && email.trim() !== "") {
        const normalized = email.trim().toLowerCase();
        if (!seenEmails.has(normalized)) {
          seenEmails.add(normalized);
          resolvedRecipients.push({
            userId: item.userId,
            email: email.trim(),
            name,
            notificationId: item.notificationId,
            message: item.message || defaultMessage,
          });
        }
      }
    }

    if (resolvedRecipients.length === 0) {
      return new Response(
        JSON.stringify({ status: "skipped", reason: "No active recipient emails found for user(s)." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Fetch related task details once if applicable
    const taskDetails: TaskDetails = {};
    if (supabaseAdmin && relatedId && notifType === "assignment") {
      const { data: task } = await supabaseAdmin
        .from("tasks")
        .select("title, priority, due_date, check_date, check_start_time, check_end_time, links, project:project_id(title)")
        .eq("id", relatedId)
        .maybeSingle();

      if (task) {
        taskDetails.title = task.title;
        taskDetails.priority = task.priority;
        taskDetails.due_date = task.due_date;
        taskDetails.check_date = task.check_date;
        taskDetails.check_start_time = task.check_start_time;
        taskDetails.check_end_time = task.check_end_time;
        const proj = task.project as { title?: string } | null;
        taskDetails.project_title = proj?.title || null;
        if (Array.isArray(task.links)) {
          taskDetails.links = task.links;
        }
      }
    }

    const emailSubject = taskDetails.title
      ? `[CP Cockpit] New Task Assigned: ${taskDetails.title}`
      : `[CP Cockpit] Notification: ${defaultMessage.substring(0, 50)}`;

    const priorityBadgeColor =
      taskDetails.priority === "urgent"
        ? "#ef4444"
        : taskDetails.priority === "high"
        ? "#f97316"
        : taskDetails.priority === "medium"
        ? "#3b82f6"
        : "#6b7280";

    const linksHtml =
      taskDetails.links && taskDetails.links.length > 0
        ? `<div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; font-weight: 600; color: #6b7280; letter-spacing: 0.05em;">Resource Links:</p>
            <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #2563eb;">
              ${taskDetails.links
                .filter((l) => l.url)
                .map(
                  (l) =>
                    `<li><a href="${l.url}" target="_blank" style="color: #2563eb; text-decoration: underline;">${
                      l.label || l.url
                    }</a></li>`
                )
                .join("")}
            </ul>
           </div>`
        : "";

    function formatTime(str?: string | null): string {
      if (!str) return "";
      return str.includes("T") ? str.split("T")[1].substring(0, 5) : str.substring(0, 5);
    }

    const checkTimeRange =
      taskDetails.check_start_time && taskDetails.check_end_time
        ? ` (${formatTime(taskDetails.check_start_time)} - ${formatTime(taskDetails.check_end_time)})`
        : taskDetails.check_start_time
        ? ` (${formatTime(taskDetails.check_start_time)})`
        : "";

    const taskCardHtml = taskDetails.title
      ? `<div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px; margin: 20px 0;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #111827; font-weight: 600;">${taskDetails.title}</h3>
          ${taskDetails.project_title ? `<p style="margin: 0 0 10px 0; font-size: 13px; color: #4b5563;"><strong>Project:</strong> ${taskDetails.project_title}</p>` : ""}
          <div style="display: flex; flex-wrap: wrap; gap: 12px; font-size: 13px; color: #374151;">
            ${
              taskDetails.priority
                ? `<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; color: #ffffff; background-color: ${priorityBadgeColor};">Priority: ${taskDetails.priority.toUpperCase()}</span>`
                : ""
            }
            ${taskDetails.due_date ? `<span style="display: inline-block; margin-left: 8px;"><strong>Due Date:</strong> ${taskDetails.due_date}</span>` : ""}
            ${taskDetails.check_date ? `<span style="display: inline-block; margin-left: 8px; color: #2563eb;"><strong>🚩 Milestone Check:</strong> ${taskDetails.check_date}${checkTimeRange}</span>` : ""}
          </div>
          ${linksHtml}
        </div>`
      : "";

    // 4. Send emails to all resolved recipients
    const dispatchResults: Array<{
      email: string;
      name: string;
      userId?: string;
      status: "sent" | "failed" | "simulated";
      error?: string;
    }> = [];

    for (const recipient of resolvedRecipients) {
      const recipientMessage = recipient.message || defaultMessage;
      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${emailSubject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 32px 16px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <div style="background-color: #0f172a; padding: 24px 32px; color: #ffffff;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">Collective Perspectives</h1>
      <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em;">Redefining Ability. Reimagining Possibility.</p>
    </div>
    <div style="padding: 32px;">
      <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151;">Hello <strong>${recipient.name}</strong>,</p>
      
      <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin-bottom: 20px;">
        <p style="margin: 0; font-size: 14px; color: #1e40af; line-height: 1.5;">${recipientMessage}</p>
      </div>

      ${taskCardHtml}

      <div style="margin-top: 28px; text-align: center;">
        <a href="${appUrl}/tasks" target="_blank" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
          Open Task in CP Cockpit →
        </a>
      </div>
    </div>
    <div style="background-color: #f9fafb; padding: 20px 32px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; line-height: 1.5;">
      <p style="margin: 0;">This is an automated notification from the <strong>Collective Perspectives CRM Workspace</strong>.</p>
      <p style="margin: 4px 0 0 0;">Singapore • Presenting Persons living with Disabilities as creators, leaders, and professionals.</p>
    </div>
  </div>
</body>
</html>
`;

      const textContent = `
Collective Perspectives Workspace
Redefining Ability. Reimagining Possibility.

Hello ${recipient.name},

${recipientMessage}

${taskDetails.title ? `Task: ${taskDetails.title}\nProject: ${taskDetails.project_title || "N/A"}\nPriority: ${taskDetails.priority || "Normal"}\nDue Date: ${taskDetails.due_date || "N/A"}${checkTimeRange ? `\nMilestone Check: ${taskDetails.check_date}${checkTimeRange}` : ""}` : ""}

View your tasks in the CP Cockpit:
${appUrl}/tasks

Collective Perspectives • Singapore
`;

      let deliveryStatus: "sent" | "failed" | "simulated" = "simulated";
      let externalResponse: string | null = null;
      let sendError: string | undefined = undefined;

      if (resendApiKey) {
        try {
          const resendRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: fromEmail,
              to: [recipient.email],
              subject: emailSubject,
              html: htmlContent,
              text: textContent,
            }),
          });

          const resendData = await resendRes.json();
          if (resendRes.ok) {
            deliveryStatus = "sent";
            externalResponse = JSON.stringify(resendData);
          } else {
            deliveryStatus = "failed";
            externalResponse = JSON.stringify(resendData);
            sendError = JSON.stringify(resendData);
            console.error(`Resend error for ${recipient.email}:`, resendData);
          }
        } catch (sendErr) {
          deliveryStatus = "failed";
          externalResponse = String(sendErr);
          sendError = String(sendErr);
          console.error(`Exception sending to ${recipient.email}:`, sendErr);
        }
      } else {
        console.log(`[Email Simulated] Dispatched notification email to: ${recipient.email} (${recipient.name})`);
        deliveryStatus = "simulated";
      }

      dispatchResults.push({
        email: recipient.email,
        name: recipient.name,
        userId: recipient.userId,
        status: deliveryStatus,
        error: sendError,
      });

      // Update or insert notification webhook log
      if (supabaseAdmin) {
        const notifId = recipient.notificationId || body.notification_id || singleRecord?.id;
        if (notifId) {
          await supabaseAdmin
            .from("notification_webhook_logs")
            .update({
              status: deliveryStatus,
              response_code: deliveryStatus === "failed" ? 500 : 200,
              response_body: externalResponse || (deliveryStatus === "simulated" ? "Simulated local delivery" : "OK"),
              updated_at: new Date().toISOString(),
            })
            .eq("notification_id", notifId);
        }
      }
    }

    // 5. Synchronize task with Google Calendar (Create or Update based on relatedId/task id)
    let calendarSyncResult: CalendarSyncResult = { status: "skipped" };
    if (supabaseAdmin && relatedId) {
      try {
        calendarSyncResult = await syncTaskWithGoogleCalendar(supabaseAdmin, relatedId, appUrl);
      } catch (calErr) {
        console.error("[send-notification-email] Error during Google Calendar sync:", calErr);
        calendarSyncResult = {
          status: "failed",
          error: calErr instanceof Error ? calErr.message : String(calErr),
        };
      }
    }

    const sentCount = dispatchResults.filter((r) => r.status === "sent").length;
    const simulatedCount = dispatchResults.filter((r) => r.status === "simulated").length;
    const failedCount = dispatchResults.filter((r) => r.status === "failed").length;

    const overallStatus =
      failedCount === 0
        ? (sentCount > 0 ? "sent" : "simulated")
        : sentCount > 0
        ? "partial"
        : "failed";

    return new Response(
      JSON.stringify({
        success: failedCount < dispatchResults.length,
        status: overallStatus,
        totalRecipients: dispatchResults.length,
        sentCount,
        simulatedCount,
        failedCount,
        recipients: dispatchResults,
        // Provided for single-recipient backwards compatibility
        recipient: {
          email: dispatchResults[0]?.email,
          name: dispatchResults[0]?.name,
        },
        subject: emailSubject,
        calendar: calendarSyncResult,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[send-notification-email] Unhandled error:", err);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
