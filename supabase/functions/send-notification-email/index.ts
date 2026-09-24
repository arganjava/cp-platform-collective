// Supabase Edge Function: send-notification-email
// Location: supabase/functions/send-notification-email/index.ts
//
// Triggered by Database Webhook or direct API call when a notification is created.
// Looks up the recipient's profiles.email and dispatches a notification email.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface WebhookPayload {
  type?: string;
  table?: string;
  schema?: string;
  record?: {
    id?: string;
    user_id?: string;
    message?: string;
    type?: string;
    is_read?: boolean;
    related_id?: string | null;
    created_at?: string;
  };
  notification?: {
    id?: string;
    user_id?: string;
    message?: string;
    type?: string;
    is_read?: boolean;
    related_id?: string | null;
    created_at?: string;
  };
  recipient?: {
    name?: string;
    email?: string;
  };
  notification_id?: string;
  user_id?: string;
  message?: string;
}

interface TaskDetails {
  title?: string;
  priority?: string;
  due_date?: string | null;
  check_date?: string | null;
  project_title?: string | null;
  links?: Array<{ label?: string; url?: string }>;
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
    const appUrl = Deno.env.get("APP_URL") || "https://cp-platform.collectivep.com";
    let resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("NOTIFICATION_FROM_EMAIL") || "Collective Perspectives <notifications@collectivep.com>";

    const body: WebhookPayload = await req.json().catch(() => ({}));

    // Normalize notification record from various webhook or direct calling formats
    const notifRecord = body.record || body.notification || {
      id: body.notification_id,
      user_id: body.user_id,
      message: body.message,
    };

    const notificationId = notifRecord.id || body.notification_id;
    const userId = notifRecord.user_id || body.user_id;
    const rawMessage = notifRecord.message || body.message || "You have a new update in Collective Perspectives.";
    const notifType = notifRecord.type || "assignment";
    const relatedId = notifRecord.related_id;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "user_id is required to send notification email." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let recipientEmail = body.recipient?.email;
    let recipientName = body.recipient?.name || "Team Member";

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

    // If recipient email is not in payload, look up from public.profiles
    if (!recipientEmail && supabaseAdmin) {
      const { data: profile, error: profileErr } = await supabaseAdmin
        .from("profiles")
        .select("id, name, email, is_deleted, deleted_at")
        .eq("id", userId)
        .maybeSingle();

      if (profileErr) {
        console.error("Error fetching recipient profile:", profileErr);
      }

      if (profile) {
        if (profile.is_deleted || profile.deleted_at) {
          return new Response(
            JSON.stringify({ status: "skipped", reason: "Profile is soft-deleted." }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        recipientEmail = profile.email;
        recipientName = profile.name || recipientName;
      }
    }

    if (!recipientEmail) {
      console.warn(`[send-notification-email] No email found for user_id: ${userId}`);
      return new Response(
        JSON.stringify({ status: "skipped", reason: "No recipient email found for user." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If there is a related task, fetch additional task context
    const taskDetails: TaskDetails = {};
    if (supabaseAdmin && relatedId && notifType === "assignment") {
      const { data: task } = await supabaseAdmin
        .from("tasks")
        .select("title, priority, due_date, check_date, links, project:project_id(title)")
        .eq("id", relatedId)
        .maybeSingle();

      if (task) {
        taskDetails.title = task.title;
        taskDetails.priority = task.priority;
        taskDetails.due_date = task.due_date;
        taskDetails.check_date = task.check_date;
        const proj = task.project as { title?: string } | null;
        taskDetails.project_title = proj?.title || null;
        if (Array.isArray(task.links)) {
          taskDetails.links = task.links;
        }
      }
    }

    // Compose email subject and HTML
    const emailSubject = taskDetails.title
      ? `[CP Cockpit] New Task Assigned: ${taskDetails.title}`
      : `[CP Cockpit] Notification: ${rawMessage.substring(0, 50)}`;

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
            ${taskDetails.check_date ? `<span style="display: inline-block; margin-left: 8px; color: #2563eb;"><strong>🚩 Milestone Check:</strong> ${taskDetails.check_date}</span>` : ""}
          </div>
          ${linksHtml}
        </div>`
      : "";

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${emailSubject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 32px 16px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <!-- Header -->
    <div style="background-color: #0f172a; padding: 24px 32px; color: #ffffff;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">Collective Perspectives</h1>
      <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em;">Redefining Ability. Reimagining Possibility.</p>
    </div>

    <!-- Body -->
    <div style="padding: 32px;">
      <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151;">Hello <strong>${recipientName}</strong>,</p>
      
      <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin-bottom: 20px;">
        <p style="margin: 0; font-size: 14px; color: #1e40af; line-height: 1.5;">${rawMessage}</p>
      </div>

      ${taskCardHtml}

      <div style="margin-top: 28px; text-align: center;">
        <a href="${appUrl}/tasks" target="_blank" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
          Open Task in CP Cockpit →
        </a>
      </div>
    </div>

    <!-- Footer -->
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

Hello ${recipientName},

${rawMessage}

${taskDetails.title ? `Task: ${taskDetails.title}\nProject: ${taskDetails.project_title || "N/A"}\nPriority: ${taskDetails.priority || "Normal"}\nDue Date: ${taskDetails.due_date || "N/A"}` : ""}

View your tasks in the CP Cockpit:
${appUrl}/tasks

Collective Perspectives • Singapore
`;

    let deliveryStatus = "simulated";
    let externalResponse = null;

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
            to: [recipientEmail],
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
          console.error("Resend API delivery error:", resendData);
        }
      } catch (sendErr) {
        deliveryStatus = "failed";
        externalResponse = String(sendErr);
        console.error("Exception sending via Resend:", sendErr);
      }
    } else {
      console.log(`[Email Simulated] Dispatched notification email to: ${recipientEmail}`);
      console.log(`Subject: ${emailSubject}`);
      deliveryStatus = "simulated";
    }

    // Update notification_webhook_logs record if available
    if (supabaseAdmin && notificationId) {
      await supabaseAdmin
        .from("notification_webhook_logs")
        .update({
          status: deliveryStatus,
          response_code: deliveryStatus === "failed" ? 500 : 200,
          response_body: externalResponse || (deliveryStatus === "simulated" ? "Simulated local delivery" : "OK"),
          updated_at: new Date().toISOString(),
        })
        .eq("notification_id", notificationId);
    }

    return new Response(
      JSON.stringify({
        success: deliveryStatus !== "failed",
        status: deliveryStatus,
        notificationId,
        recipient: { email: recipientEmail, name: recipientName },
        subject: emailSubject,
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
