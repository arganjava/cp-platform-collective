import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

// Mock @supabase/supabase-js
vi.mock("@supabase/supabase-js", () => {
  return {
    createClient: vi.fn(() => ({
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "u-123",
                name: "Marcus Tan",
                email: "marcus@collectivep.com",
                is_deleted: false,
                deleted_at: null,
              },
              error: null,
            }),
          };
        }
        if (table === "tasks") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                title: "Frame Artworks for Exhibition",
                priority: "high",
                due_date: "2026-09-30",
                check_date: "2026-09-27",
                project: { title: "Singtel Showcase 2026" },
                links: [{ label: "Figma", url: "https://figma.com/file/123" }],
              },
              error: null,
            }),
          };
        }
        if (table === "notification_webhook_logs") {
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
    })),
  };
});

describe("POST /api/notifications/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  });

  it("returns 400 when user_id is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/notifications/webhook", {
      method: "POST",
      body: JSON.stringify({ message: "Hello without user_id" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("user_id is required");
  });

  it("dispatches simulated notification email when recipient email is provided", async () => {
    const req = new NextRequest("http://localhost:3000/api/notifications/webhook", {
      method: "POST",
      body: JSON.stringify({
        record: {
          id: "notif-1",
          user_id: "u-123",
          message: 'You have been assigned to task: "Frame Artworks for Exhibition"',
          type: "assignment",
          related_id: "t-1",
        },
        recipient: {
          name: "Marcus Tan",
          email: "marcus@collectivep.com",
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.recipient.email).toBe("marcus@collectivep.com");
    expect(data.recipient.name).toBe("Marcus Tan");
    expect(data.subject).toContain("Frame Artworks for Exhibition");
  });

  it("resolves recipient profile email when not explicitly passed in payload", async () => {
    const req = new NextRequest("http://localhost:3000/api/notifications/webhook", {
      method: "POST",
      body: JSON.stringify({
        record: {
          id: "notif-2",
          user_id: "u-123",
          message: 'You have been assigned to task: "Frame Artworks for Exhibition"',
          type: "assignment",
          related_id: "t-1",
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.recipient.email).toBe("marcus@collectivep.com");
  });

  it("handles multiple send email with recipients array", async () => {
    const req = new NextRequest("http://localhost:3000/api/notifications/webhook", {
      method: "POST",
      body: JSON.stringify({
        message: 'You have been assigned to task: "Frame Artworks for Exhibition"',
        related_id: "t-1",
        recipients: [
          { name: "Marcus Tan", email: "marcus@collectivep.com", user_id: "u-123" },
          { name: "Sarah Lim", email: "sarah@collectivep.com", user_id: "u-456" },
        ],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.totalRecipients).toBe(2);
    expect(data.recipients).toHaveLength(2);
    expect(data.recipients[0].email).toBe("marcus@collectivep.com");
    expect(data.recipients[1].email).toBe("sarah@collectivep.com");
  });
});
