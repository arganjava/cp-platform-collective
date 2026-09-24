import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

export async function POST(req: NextRequest) {
  try {
    const body: WebhookPayload = await req.json().catch(() => ({}));

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
      return NextResponse.json({ error: "user_id is required." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://cp-platform.collectivep.com";
    let resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.NOTIFICATION_FROM_EMAIL || "Collective Perspectives <notifications@collectivep.com>";

    let recipientEmail = body.recipient?.email;
    let recipientName = body.recipient?.name || "Team Member";

    let supabaseAdmin = null;
    if (supabaseUrl && serviceRoleKey) {
      supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }

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

    if (!recipientEmail && supabaseAdmin) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, name, email, is_deleted, deleted_at")
        .eq("id", userId)
        .maybeSingle();

      if (profile) {
        if (profile.is_deleted || profile.deleted_at) {
          return NextResponse.json({ status: "skipped", reason: "Profile is soft-deleted." }, { status: 200 });
        }
        recipientEmail = profile.email;
        recipientName = profile.name || recipientName;
      }
    }

    if (!recipientEmail) {
      return NextResponse.json({ status: "skipped", reason: "No recipient email found for user." }, { status: 200 });
    }

    // Optional: fetch task details for rich assignment context
    let taskTitle = "";
    let projectTitle = "";
    let priority = "";
    let dueDate = "";
    let checkDate = "";
    let links: Array<{ label?: string; url?: string }> = [];

    if (supabaseAdmin && relatedId && notifType === "assignment") {
      const { data: task } = await supabaseAdmin
        .from("tasks")
        .select("title, priority, due_date, check_date, links, project:project_id(title)")
        .eq("id", relatedId)
        .maybeSingle();

      if (task) {
        taskTitle = task.title;
        priority = task.priority;
        dueDate = task.due_date || "";
        checkDate = task.check_date || "";
        const proj = task.project as { title?: string } | null;
        projectTitle = proj?.title || "";
        if (Array.isArray(task.links)) {
          links = task.links;
        }
      }
    }

    const emailSubject = taskTitle
      ? `[CP Cockpit] New Task Assigned: ${taskTitle}`
      : `[CP Cockpit] Notification: ${rawMessage.substring(0, 50)}`;

    const priorityBadgeColor =
      priority === "urgent"
        ? "#ef4444"
        : priority === "high"
        ? "#f97316"
        : priority === "medium"
        ? "#3b82f6"
        : "#6b7280";

    const linksHtml =
      links.length > 0
        ? `<div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; font-weight: 600; color: #6b7280; letter-spacing: 0.05em;">Resource Links:</p>
            <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #2563eb;">
              ${links
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

    const taskCardHtml = taskTitle
      ? `<div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px; margin: 20px 0;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #111827; font-weight: 600;">${taskTitle}</h3>
          ${projectTitle ? `<p style="margin: 0 0 10px 0; font-size: 13px; color: #4b5563;"><strong>Project:</strong> ${projectTitle}</p>` : ""}
          <div style="display: flex; flex-wrap: wrap; gap: 12px; font-size: 13px; color: #374151;">
            ${
              priority
                ? `<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; color: #ffffff; background-color: ${priorityBadgeColor};">Priority: ${priority.toUpperCase()}</span>`
                : ""
            }
            ${dueDate ? `<span style="display: inline-block; margin-left: 8px;"><strong>Due Date:</strong> ${dueDate}</span>` : ""}
            ${checkDate ? `<span style="display: inline-block; margin-left: 8px; color: #2563eb;"><strong>🚩 Milestone Check:</strong> ${checkDate}</span>` : ""}
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
    <div style="background-color: #0f172a; padding: 24px 32px; color: #ffffff;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">Collective Perspectives</h1>
      <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em;">Redefining Ability. Reimagining Possibility.</p>
    </div>
    <div style="padding: 32px;">
      <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151;">Hello <strong>${recipientName}</strong>,</p>
      <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin-bottom: 20px;">
        <p style="margin: 0; font-size: 14px; color: #1e40af; line-height: 1.5;">${rawMessage}</p>
      </div>
      ${taskCardHtml}
      <div style="margin-top: 28px; text-align: center;">
        <a href="${appUrl}/tasks" target="_blank" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">
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

    let deliveryStatus = "simulated";
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
          }),
        });
        if (resendRes.ok) {
          deliveryStatus = "sent";
        } else {
          deliveryStatus = "failed";
        }
      } catch (e) {
        deliveryStatus = "failed";
        console.error("Resend delivery failed:", e);
      }
    } else {
      deliveryStatus = "simulated";
    }

    if (supabaseAdmin && notificationId) {
      await supabaseAdmin
        .from("notification_webhook_logs")
        .update({
          status: deliveryStatus,
          response_code: deliveryStatus === "failed" ? 500 : 200,
          updated_at: new Date().toISOString(),
        })
        .eq("notification_id", notificationId);
    }

    return NextResponse.json({
      success: deliveryStatus !== "failed",
      status: deliveryStatus,
      recipient: { email: recipientEmail, name: recipientName },
      subject: emailSubject,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[api/notifications/webhook] Error:", err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
