import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";
import crypto from "crypto";

const testKeyPair = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

let mockAppConfig: Record<string, string> = {};
let mockTaskRecord: Record<string, any> = {
  id: "t-1",
  title: "Frame Artworks for Exhibition",
  description: "High quality wooden frames for Singtel showcase",
  priority: "high",
  status: "in_progress",
  due_date: "2026-09-30",
  check_date: "2026-09-27",
  check_start_time: "2026-09-27T10:00:00Z",
  check_end_time: "2026-09-27T11:30:00Z",
  google_calendar_id: null,
  assignee_id: "u-123",
  project: { title: "Singtel Showcase 2026" },
  links: [{ label: "Figma", url: "https://figma.com/file/123" }],
};
let updatedTaskCalendarId: string | null = null;

// Mock @supabase/supabase-js
vi.mock("@supabase/supabase-js", () => {
  return {
    createClient: vi.fn(() => ({
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "u-123",
                  name: "Marcus Tan",
                  email: "marcus@collectivep.com",
                  is_deleted: false,
                  deleted_at: null,
                },
                {
                  id: "u-456",
                  name: "Sarah Lim",
                  email: "sarah@collectivep.com",
                  is_deleted: false,
                  deleted_at: null,
                },
              ],
              error: null,
            }),
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
            maybeSingle: vi.fn().mockImplementation(() =>
              Promise.resolve({
                data: mockTaskRecord,
                error: null,
              })
            ),
            update: vi.fn().mockImplementation((payload: any) => {
              if (payload.google_calendar_id !== undefined) {
                updatedTaskCalendarId = payload.google_calendar_id;
              }
              return {
                eq: vi.fn().mockResolvedValue({ data: null, error: null }),
              };
            }),
          };
        }
        if (table === "task_profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [{ profile_id: "u-123" }, { profile_id: "u-456" }],
              error: null,
            }),
          };
        }
        if (table === "app_config") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn((_col: string, keys: string[]) => {
              const rows = keys
                .filter((k) => mockAppConfig[k] !== undefined)
                .map((k) => ({ key: k, value: mockAppConfig[k] }));
              return Promise.resolve({ data: rows, error: null });
            }),
            eq: vi.fn((_col: string, val: string) => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: mockAppConfig[val] ? { value: mockAppConfig[val] } : null,
                error: null,
              }),
            })),
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
    mockAppConfig = {};
    updatedTaskCalendarId = null;
    mockTaskRecord = {
      id: "t-1",
      title: "Frame Artworks for Exhibition",
      description: "High quality wooden frames for Singtel showcase",
      priority: "high",
      status: "in_progress",
      due_date: "2026-09-30",
      check_date: "2026-09-27",
      check_start_time: "2026-09-27T10:00:00Z",
      check_end_time: "2026-09-27T11:30:00Z",
      google_calendar_id: null,
      assignee_id: "u-123",
      project: { title: "Singtel Showcase 2026" },
      links: [{ label: "Figma", url: "https://figma.com/file/123" }],
    };
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

  it("creates a Google Calendar event when google_calendar_id is null and updates task", async () => {
    mockAppConfig.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify({
      client_email: "test-sa@project.iam.gserviceaccount.com",
      private_key: testKeyPair.privateKey,
    });

    let calendarPayloadSent: any = null;
    let calendarMethodSent: string = "";

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url: any, opts: any) => {
      const urlStr = String(url);
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "mock-google-access-token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (urlStr.includes("googleapis.com/calendar/v3/calendars/primary/events")) {
        calendarMethodSent = opts?.method;
        calendarPayloadSent = JSON.parse(opts?.body || "{}");
        return new Response(JSON.stringify({ id: "gcal-event-created-123" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(url, opts);
    }) as any;

    try {
      const req = new NextRequest("http://localhost:3000/api/notifications/webhook", {
        method: "POST",
        body: JSON.stringify({
          record: {
            id: "notif-cal-1",
            user_id: "u-123",
            message: "Assigned to task",
            type: "assignment",
            related_id: "t-1",
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.calendar.status).toBe("created");
      expect(data.calendar.calendarEventId).toBe("gcal-event-created-123");
      expect(updatedTaskCalendarId).toBe("gcal-event-created-123");

      expect(calendarMethodSent).toBe("POST");
      expect(calendarPayloadSent.summary).toContain("Singtel Showcase 2026");
      expect(calendarPayloadSent.summary).toContain("Frame Artworks for Exhibition");
      expect(calendarPayloadSent.description).toContain("High quality wooden frames");
      expect(calendarPayloadSent.description).toContain("2026-09-27");
      expect(calendarPayloadSent.start.dateTime).toBe("2026-09-27T10:00:00.000Z");
      expect(calendarPayloadSent.end.dateTime).toBe("2026-09-27T11:30:00.000Z");
      expect(calendarPayloadSent.attendees).toEqual(
        expect.arrayContaining([{ email: "marcus@collectivep.com" }, { email: "sarah@collectivep.com" }])
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("updates existing Google Calendar event when google_calendar_id already exists", async () => {
    mockTaskRecord.google_calendar_id = "gcal-existing-456";
    mockAppConfig.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify({
      client_email: "test-sa@project.iam.gserviceaccount.com",
      private_key: testKeyPair.privateKey,
    });

    let calendarMethodSent: string = "";
    let calendarUrlSent: string = "";

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url: any, opts: any) => {
      const urlStr = String(url);
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "mock-google-access-token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (urlStr.includes("googleapis.com/calendar/v3/calendars/primary/events/gcal-existing-456")) {
        calendarMethodSent = opts?.method;
        calendarUrlSent = urlStr;
        return new Response(JSON.stringify({ id: "gcal-existing-456" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(url, opts);
    }) as any;

    try {
      const req = new NextRequest("http://localhost:3000/api/notifications/webhook", {
        method: "POST",
        body: JSON.stringify({
          record: {
            id: "notif-cal-2",
            user_id: "u-123",
            message: "Assigned to task",
            type: "assignment",
            related_id: "t-1",
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.calendar.status).toBe("updated");
      expect(data.calendar.calendarEventId).toBe("gcal-existing-456");
      expect(calendarMethodSent).toBe("PUT");
      expect(calendarUrlSent).toContain("gcal-existing-456");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("creates a Google Calendar event using GOOGLE_CALENDAR_API_KEY without needing JWT", async () => {
    mockTaskRecord.google_calendar_id = null;
    delete mockAppConfig.GOOGLE_SERVICE_ACCOUNT_KEY;
    mockAppConfig.GOOGLE_CALENDAR_API_KEY = "test-google-calendar-api-key-12345";

    let calendarPayloadSent: any = null;
    let calendarMethodSent: string = "";
    let calendarUrlSent: string = "";
    let apiKeyHeaderSent: string | undefined = undefined;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url: any, opts: any) => {
      const urlStr = String(url);
      if (urlStr.includes("googleapis.com/calendar/v3/calendars/primary/events")) {
        calendarUrlSent = urlStr;
        calendarMethodSent = opts?.method;
        calendarPayloadSent = JSON.parse(opts?.body || "{}");
        apiKeyHeaderSent = opts?.headers?.["X-Goog-Api-Key"];
        return new Response(JSON.stringify({ id: "gcal-event-created-via-api-key" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(url, opts);
    }) as any;

    try {
      const req = new NextRequest("http://localhost:3000/api/notifications/webhook", {
        method: "POST",
        body: JSON.stringify({
          record: {
            id: "notif-cal-apikey-1",
            user_id: "u-123",
            message: "Assigned to task",
            type: "assignment",
            related_id: "t-1",
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.calendar.status).toBe("created");
      expect(data.calendar.calendarEventId).toBe("gcal-event-created-via-api-key");
      expect(calendarMethodSent).toBe("POST");
      expect(calendarUrlSent).toContain("key=test-google-calendar-api-key-12345");
      expect(apiKeyHeaderSent).toBe("test-google-calendar-api-key-12345");
      expect(calendarPayloadSent.summary).toContain("Frame Artworks for Exhibition");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("updates existing Google Calendar event using GOOGLE_CALENDAR_API_KEY", async () => {
    mockTaskRecord.google_calendar_id = "gcal-existing-api-key-789";
    delete mockAppConfig.GOOGLE_SERVICE_ACCOUNT_KEY;
    mockAppConfig.GOOGLE_CALENDAR_API_KEY = "test-google-calendar-api-key-12345";

    let calendarMethodSent: string = "";
    let calendarUrlSent: string = "";

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url: any, opts: any) => {
      const urlStr = String(url);
      if (urlStr.includes("googleapis.com/calendar/v3/calendars/primary/events/gcal-existing-api-key-789")) {
        calendarMethodSent = opts?.method;
        calendarUrlSent = urlStr;
        return new Response(JSON.stringify({ id: "gcal-existing-api-key-789" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(url, opts);
    }) as any;

    try {
      const req = new NextRequest("http://localhost:3000/api/notifications/webhook", {
        method: "POST",
        body: JSON.stringify({
          record: {
            id: "notif-cal-apikey-2",
            user_id: "u-123",
            message: "Assigned to task",
            type: "assignment",
            related_id: "t-1",
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.calendar.status).toBe("updated");
      expect(data.calendar.calendarEventId).toBe("gcal-existing-api-key-789");
      expect(calendarMethodSent).toBe("PUT");
      expect(calendarUrlSent).toContain("gcal-existing-api-key-789");
      expect(calendarUrlSent).toContain("key=test-google-calendar-api-key-12345");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("creates a Google Calendar event using GOOGLE_REFRESH_TOKEN by exchanging for access token", async () => {
    mockTaskRecord.google_calendar_id = null;
    delete mockAppConfig.GOOGLE_SERVICE_ACCOUNT_KEY;
    delete mockAppConfig.GOOGLE_CALENDAR_API_KEY;
    mockAppConfig.GOOGLE_REFRESH_TOKEN = "1//04mockRefreshToken123";
    mockAppConfig.GOOGLE_CLIENT_ID = "mock-client-id.apps.googleusercontent.com";
    mockAppConfig.GOOGLE_CLIENT_SECRET = "mock-client-secret-xyz";

    let tokenEndpointCalled = false;
    let tokenParamsSent = "";
    let calendarAuthHeaderSent = "";
    let calendarMethodSent = "";

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url: any, opts: any) => {
      const urlStr = String(url);
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        tokenEndpointCalled = true;
        tokenParamsSent = String(opts?.body || "");
        return new Response(JSON.stringify({ access_token: "ya29.mock-oauth-access-token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (urlStr.includes("googleapis.com/calendar/v3/calendars/primary/events")) {
        calendarMethodSent = opts?.method;
        calendarAuthHeaderSent = opts?.headers?.["Authorization"];
        return new Response(JSON.stringify({ id: "gcal-event-created-via-refresh-token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(url, opts);
    }) as any;

    try {
      const req = new NextRequest("http://localhost:3000/api/notifications/webhook", {
        method: "POST",
        body: JSON.stringify({
          record: {
            id: "notif-cal-refresh-1",
            user_id: "u-123",
            message: "Assigned to task",
            type: "assignment",
            related_id: "t-1",
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(tokenEndpointCalled).toBe(true);
      expect(tokenParamsSent).toContain("grant_type=refresh_token");
      expect(tokenParamsSent).toContain("1%2F%2F04mockRefreshToken123");
      expect(tokenParamsSent).toContain("mock-client-id.apps.googleusercontent.com");
      expect(tokenParamsSent).toContain("mock-client-secret-xyz");

      expect(calendarMethodSent).toBe("POST");
      expect(calendarAuthHeaderSent).toBe("Bearer ya29.mock-oauth-access-token");
      expect(data.calendar.status).toBe("created");
      expect(data.calendar.calendarEventId).toBe("gcal-event-created-via-refresh-token");
      expect(updatedTaskCalendarId).toBe("gcal-event-created-via-refresh-token");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("updates existing Google Calendar event when GOOGLE_REFRESH_TOKEN is provided as a JSON string", async () => {
    mockTaskRecord.google_calendar_id = "gcal-existing-refresh-999";
    delete mockAppConfig.GOOGLE_SERVICE_ACCOUNT_KEY;
    delete mockAppConfig.GOOGLE_CALENDAR_API_KEY;
    delete mockAppConfig.GOOGLE_CLIENT_ID;
    delete mockAppConfig.GOOGLE_CLIENT_SECRET;
    mockAppConfig.GOOGLE_REFRESH_TOKEN = JSON.stringify({
      refresh_token: "1//04jsonRefreshToken456",
      client_id: "json-client-id.apps.googleusercontent.com",
      client_secret: "json-client-secret",
    });

    let tokenEndpointCalled = false;
    let tokenParamsSent = "";
    let calendarMethodSent = "";
    let calendarAuthHeaderSent = "";

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url: any, opts: any) => {
      const urlStr = String(url);
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        tokenEndpointCalled = true;
        tokenParamsSent = String(opts?.body || "");
        return new Response(JSON.stringify({ access_token: "ya29.json-oauth-access-token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (urlStr.includes("googleapis.com/calendar/v3/calendars/primary/events/gcal-existing-refresh-999")) {
        calendarMethodSent = opts?.method;
        calendarAuthHeaderSent = opts?.headers?.["Authorization"];
        return new Response(JSON.stringify({ id: "gcal-existing-refresh-999" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(url, opts);
    }) as any;

    try {
      const req = new NextRequest("http://localhost:3000/api/notifications/webhook", {
        method: "POST",
        body: JSON.stringify({
          record: {
            id: "notif-cal-refresh-2",
            user_id: "u-123",
            message: "Assigned to task",
            type: "assignment",
            related_id: "t-1",
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(tokenEndpointCalled).toBe(true);
      expect(tokenParamsSent).toContain("1%2F%2F04jsonRefreshToken456");
      expect(tokenParamsSent).toContain("json-client-id.apps.googleusercontent.com");
      expect(tokenParamsSent).toContain("json-client-secret");

      expect(calendarMethodSent).toBe("PUT");
      expect(calendarAuthHeaderSent).toBe("Bearer ya29.json-oauth-access-token");
      expect(data.calendar.status).toBe("updated");
      expect(data.calendar.calendarEventId).toBe("gcal-existing-refresh-999");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("automatically enforces end > start by at least 1 hour when check_end_time equals check_start_time to prevent timeRangeEmpty 400 error", async () => {
    mockTaskRecord.google_calendar_id = null;
    mockTaskRecord.check_start_time = "2026-09-30T14:00:00Z";
    mockTaskRecord.check_end_time = "2026-09-30T14:00:00Z"; // Same as start time!
    mockAppConfig.GOOGLE_REFRESH_TOKEN = "1//mockRefreshToken";
    mockAppConfig.GOOGLE_CLIENT_ID = "mock-client";
    mockAppConfig.GOOGLE_CLIENT_SECRET = "mock-secret";

    let eventPayloadSent: any = null;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url: any, opts: any) => {
      const urlStr = String(url);
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "ya29.safe-range-token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (urlStr.includes("googleapis.com/calendar/v3/calendars/primary/events")) {
        eventPayloadSent = JSON.parse(opts?.body || "{}");
        return new Response(JSON.stringify({ id: "gcal-event-safe-timerange" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(url, opts);
    }) as any;

    try {
      const req = new NextRequest("http://localhost:3000/api/notifications/webhook", {
        method: "POST",
        body: JSON.stringify({
          record: {
            id: "notif-cal-timerange-1",
            user_id: "u-123",
            message: "Assigned to task",
            type: "assignment",
            related_id: "t-1",
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.calendar.status).toBe("created");
      expect(data.calendar.calendarEventId).toBe("gcal-event-safe-timerange");

      const startTime = new Date(eventPayloadSent.start.dateTime).getTime();
      const endTime = new Date(eventPayloadSent.end.dateTime).getTime();

      expect(endTime).toBeGreaterThan(startTime);
      expect(endTime - startTime).toBeGreaterThanOrEqual(60 * 60 * 1000); // At least 1 hour duration
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
