import type { User, Project, Task, Sale, Notification } from "./types";

export const seedUsers: User[] = [
  { id: "user-1", name: "Vincent Lim", email: "vincent@collectivep.com", avatarColor: "var(--primary)", role: "admin" },
  { id: "user-2", name: "Michael Chua", email: "michael@collectivep.com", avatarColor: "var(--brand)", role: "admin" },
  { id: "user-3", name: "Lim Lee Lee", email: "leelee@collectivep.com", avatarColor: "var(--muted-foreground)", role: "guest" },
  { id: "user-4", name: "Douglas Danapal", email: "douglas@collectivep.com", avatarColor: "var(--destructive)", role: "guest" },
  { id: "user-5", name: "Abu Sahl (Iqbal)", email: "iqbal@collectivep.com", avatarColor: "var(--primary)", role: "guest" },
  { id: "user-6", name: "Ryan Putra", email: "ryan@collectivep.com", avatarColor: "var(--brand)", role: "guest" },
  { id: "user-7", name: "Stephanie Fam", email: "stephanie@collectivep.com", avatarColor: "var(--muted-foreground)", role: "guest" },
  { id: "user-8", name: "Jeffrey Lim", email: "jeffrey@collectivep.com", avatarColor: "var(--destructive)", role: "guest" },
];

export const seedProjects: Project[] = [
  {
    id: "proj-1",
    title: "DARE Festival 2026",
    description: "Annual flagship arts festival celebrating PwD creatives — performances, exhibitions, and digital content.",
    status: "active",
    color: "var(--primary)",
    ownerId: "user-1",
    memberIds: ["user-1", "user-2", "user-3", "user-4", "user-5"],
    startDate: "2026-06-01",
    endDate: "2026-11-15",
    createdAt: "2026-03-10T09:00:00Z",
  },
  {
    id: "proj-2",
    title: "Ville of Joy — Fragrance Launch",
    description: "Co-created fragrance line with Lim Lee Lee. Packaging, branding, and e-commerce rollout.",
    status: "active",
    color: "var(--brand)",
    ownerId: "user-3",
    memberIds: ["user-3", "user-7", "user-8"],
    startDate: "2026-04-15",
    endDate: "2026-09-30",
    createdAt: "2026-04-01T10:00:00Z",
  },
  {
    id: "proj-3",
    title: "Shades — Poetry Book",
    description: "Stephanie Esther Fam's poetry collection. Editing, design, printing, and distribution.",
    status: "active",
    color: "var(--muted-foreground)",
    ownerId: "user-7",
    memberIds: ["user-7", "user-8", "user-2"],
    startDate: "2026-05-01",
    endDate: "2026-08-31",
    createdAt: "2026-04-20T11:00:00Z",
  },
  {
    id: "proj-4",
    title: "Corporate Training Programme",
    description: "Disability awareness & inclusion workshops for corporate partners (TBWA, Far East Org).",
    status: "active",
    color: "var(--destructive)",
    ownerId: "user-4",
    memberIds: ["user-4", "user-5", "user-6"],
    startDate: "2026-07-01",
    endDate: "2026-12-31",
    createdAt: "2026-06-15T08:00:00Z",
  },
  {
    id: "proj-5",
    title: "Digital Content Hub",
    description: "Online platform for streaming PwD artist performances, behind-the-scenes, and educational content.",
    status: "draft",
    color: "var(--primary)",
    ownerId: "user-2",
    memberIds: ["user-2", "user-5", "user-6"],
    startDate: "2026-09-01",
    endDate: "2027-03-31",
    createdAt: "2026-07-01T09:00:00Z",
  },
];

export const seedTasks: Task[] = [
  // DARE Festival tasks
  { id: "task-1", projectId: "proj-1", title: "Secure venue booking for DARE Festival", description: "Negotiate with National Gallery / Drama Centre for Nov dates", status: "done", priority: "high", assigneeId: "user-1", startDate: "2026-06-01", dueDate: "2026-06-30", tags: ["logistics", "venue"], createdAt: "2026-06-01T09:00:00Z", order: 0 },
  { id: "task-2", projectId: "proj-1", title: "Finalise artist lineup and schedule", description: "Confirm performers, workshop leaders, exhibition artists", status: "done", priority: "high", assigneeId: "user-3", startDate: "2026-06-15", dueDate: "2026-07-31", tags: ["artists", "programming"], createdAt: "2026-06-15T09:00:00Z", order: 1 },
  { id: "task-3", projectId: "proj-1", title: "Design festival marketing materials", description: "Poster, social media assets, programme booklet", status: "in_progress", priority: "high", assigneeId: "user-8", startDate: "2026-07-01", dueDate: "2026-08-15", tags: ["design", "marketing"], createdAt: "2026-07-01T09:00:00Z", order: 0 },
  { id: "task-4", projectId: "proj-1", title: "Apply for NAC grant funding", description: "National Arts Council project grant application", status: "review", priority: "urgent", assigneeId: "user-2", startDate: "2026-07-10", dueDate: "2026-07-31", tags: ["funding", "admin"], createdAt: "2026-07-10T09:00:00Z", order: 0 },
  { id: "task-5", projectId: "proj-1", title: "Set up accessibility arrangements", description: "Wheelchair access, sign language interpreters, audio descriptions", status: "in_progress", priority: "high", assigneeId: "user-4", startDate: "2026-07-15", dueDate: "2026-09-30", tags: ["accessibility"], createdAt: "2026-07-15T09:00:00Z", order: 1 },
  { id: "task-6", projectId: "proj-1", title: "Launch ticket sales", description: "Set up Eventbrite / Peatix and begin early bird sales", status: "todo", priority: "medium", assigneeId: "user-5", startDate: "2026-08-01", dueDate: "2026-08-31", tags: ["ticketing", "sales"], createdAt: "2026-07-20T09:00:00Z", order: 0 },
  { id: "task-7", projectId: "proj-1", title: "Coordinate volunteer team", description: "Recruit and brief 50+ volunteers for festival days", status: "todo", priority: "medium", assigneeId: "user-6", startDate: "2026-09-01", dueDate: "2026-10-31", tags: ["volunteers"], createdAt: "2026-07-22T09:00:00Z", order: 1 },

  // Ville of Joy tasks
  { id: "task-8", projectId: "proj-2", title: "Finalise fragrance formulations", description: "Work with Lynk Artisan on scent profiles", status: "done", priority: "high", assigneeId: "user-3", startDate: "2026-04-15", dueDate: "2026-05-31", tags: ["product"], createdAt: "2026-04-15T09:00:00Z", order: 0 },
  { id: "task-9", projectId: "proj-2", title: "Design packaging and labels", description: "Bottle design, box design, label copy", status: "in_progress", priority: "high", assigneeId: "user-8", startDate: "2026-06-01", dueDate: "2026-07-31", tags: ["design", "packaging"], createdAt: "2026-06-01T09:00:00Z", order: 0 },
  { id: "task-10", projectId: "proj-2", title: "Set up e-commerce store page", description: "Product listing, photos, descriptions on Shopify", status: "todo", priority: "medium", assigneeId: "user-7", startDate: "2026-07-15", dueDate: "2026-08-31", tags: ["e-commerce"], createdAt: "2026-07-15T09:00:00Z", order: 0 },
  { id: "task-11", projectId: "proj-2", title: "Plan launch event", description: "Intimate launch with media, influencers, and partners", status: "todo", priority: "medium", assigneeId: "user-3", startDate: "2026-08-01", dueDate: "2026-09-15", tags: ["event", "PR"], createdAt: "2026-07-20T09:00:00Z", order: 1 },

  // Shades Poetry Book tasks
  { id: "task-12", projectId: "proj-3", title: "Complete manuscript editing", description: "Final proofreading and copy editing", status: "review", priority: "high", assigneeId: "user-7", startDate: "2026-05-01", dueDate: "2026-06-30", tags: ["editing"], createdAt: "2026-05-01T09:00:00Z", order: 0 },
  { id: "task-13", projectId: "proj-3", title: "Book cover design", description: "Collaborate with artist for cover illustration", status: "in_progress", priority: "medium", assigneeId: "user-8", startDate: "2026-06-15", dueDate: "2026-07-31", tags: ["design"], createdAt: "2026-06-15T09:00:00Z", order: 0 },
  { id: "task-14", projectId: "proj-3", title: "Arrange printing", description: "Get quotes from local printers, select paper stock", status: "todo", priority: "medium", assigneeId: "user-2", startDate: "2026-07-15", dueDate: "2026-08-15", tags: ["printing"], createdAt: "2026-07-15T09:00:00Z", order: 0 },
  { id: "task-15", projectId: "proj-3", title: "Plan book launch", description: "Venue, readings, media invite", status: "todo", priority: "low", assigneeId: "user-7", startDate: "2026-08-01", dueDate: "2026-08-31", tags: ["event"], createdAt: "2026-07-20T09:00:00Z", order: 1 },

  // Corporate Training tasks
  { id: "task-16", projectId: "proj-4", title: "Develop workshop curriculum", description: "4-module programme on disability inclusion", status: "in_progress", priority: "high", assigneeId: "user-4", startDate: "2026-07-01", dueDate: "2026-08-15", tags: ["curriculum"], createdAt: "2026-07-01T09:00:00Z", order: 0 },
  { id: "task-17", projectId: "proj-4", title: "Create training materials", description: "Slide decks, handouts, video content", status: "todo", priority: "medium", assigneeId: "user-5", startDate: "2026-08-01", dueDate: "2026-09-30", tags: ["materials"], createdAt: "2026-07-15T09:00:00Z", order: 0 },
  { id: "task-18", projectId: "proj-4", title: "Pilot workshop with TBWA", description: "Run first session, collect feedback", status: "todo", priority: "high", assigneeId: "user-4", startDate: "2026-10-01", dueDate: "2026-10-31", tags: ["pilot", "delivery"], createdAt: "2026-07-20T09:00:00Z", order: 1 },

  // Digital Content Hub tasks
  { id: "task-19", projectId: "proj-5", title: "Research platform options", description: "Compare Vimeo OTT, custom build, YouTube", status: "in_progress", priority: "medium", assigneeId: "user-6", startDate: "2026-07-01", dueDate: "2026-08-15", tags: ["research", "tech"], createdAt: "2026-07-01T09:00:00Z", order: 0 },
  { id: "task-20", projectId: "proj-5", title: "Content strategy document", description: "Define content pillars, upload schedule, monetisation", status: "todo", priority: "low", assigneeId: "user-2", startDate: "2026-08-01", dueDate: "2026-09-30", tags: ["strategy"], createdAt: "2026-07-15T09:00:00Z", order: 0 },
];

export const seedSales: Sale[] = [
  { id: "sale-1", projectId: "proj-1", amount: 15000, clientName: "National Arts Council", type: "grant", date: "2026-04-15", notes: "DARE Festival project grant — approved", createdAt: "2026-04-15T10:00:00Z" },
  { id: "sale-2", projectId: "proj-1", amount: 8500, clientName: "Far East Organization", type: "sponsorship", date: "2026-05-20", notes: "Title sponsor for DARE Festival 2026", createdAt: "2026-05-20T10:00:00Z" },
  { id: "sale-3", projectId: "proj-1", amount: 5000, clientName: "TBWA Singapore", type: "sponsorship", date: "2026-06-10", notes: "Supporting sponsor", createdAt: "2026-06-10T10:00:00Z" },
  { id: "sale-4", projectId: "proj-2", amount: 3200, clientName: "Lynk Artisan", type: "commission", date: "2026-05-01", notes: "Co-creation partnership revenue share", createdAt: "2026-05-01T10:00:00Z" },
  { id: "sale-5", projectId: "proj-2", amount: 1800, clientName: "Online Store", type: "artwork", date: "2026-07-15", notes: "Pre-order fragrance sales (20 units)", createdAt: "2026-07-15T10:00:00Z" },
  { id: "sale-6", projectId: "proj-3", amount: 2000, clientName: "National Library Board", type: "commission", date: "2026-06-20", notes: "Library bulk purchase of Shades", createdAt: "2026-06-20T10:00:00Z" },
  { id: "sale-7", projectId: "proj-4", amount: 12000, clientName: "TBWA Singapore", type: "workshop", date: "2026-07-01", notes: "4-session corporate training contract", createdAt: "2026-07-01T10:00:00Z" },
  { id: "sale-8", projectId: "proj-4", amount: 6500, clientName: "CPAS", type: "workshop", date: "2026-07-10", notes: "2-session disability awareness programme", createdAt: "2026-07-10T10:00:00Z" },
  { id: "sale-9", projectId: "proj-1", amount: 4200, clientName: "Ticket Sales", type: "artwork", date: "2026-07-20", notes: "Early bird ticket revenue (84 tickets)", createdAt: "2026-07-20T10:00:00Z" },
  { id: "sale-10", projectId: "proj-2", amount: 950, clientName: "Online Store", type: "artwork", date: "2026-07-25", notes: "Additional fragrance orders", createdAt: "2026-07-25T10:00:00Z" },
];

export const seedNotifications: Notification[] = [
  { id: "notif-1", userId: "user-1", message: "Michael submitted the NAC grant application for review", type: "update", isRead: false, relatedId: "task-4", createdAt: "2026-07-28T08:30:00Z" },
  { id: "notif-2", userId: "user-1", message: "You were assigned to launch ticket sales for DARE Festival", type: "assignment", isRead: false, relatedId: "task-6", createdAt: "2026-07-27T14:00:00Z" },
  { id: "notif-3", userId: "user-1", message: "Deadline approaching: Festival marketing materials due in 18 days", type: "deadline", isRead: false, relatedId: "task-3", createdAt: "2026-07-27T09:00:00Z" },
  { id: "notif-4", userId: "user-1", message: "Stephanie completed manuscript editing — moved to review", type: "update", isRead: true, relatedId: "task-12", createdAt: "2026-07-26T16:00:00Z" },
  { id: "notif-5", userId: "user-1", message: "New sale logged: $4,200 from ticket sales", type: "update", isRead: true, relatedId: "sale-9", createdAt: "2026-07-20T10:30:00Z" },
  { id: "notif-6", userId: "user-1", message: "Douglas added a comment on accessibility arrangements", type: "comment", isRead: true, relatedId: "task-5", createdAt: "2026-07-19T11:00:00Z" },
  { id: "notif-7", userId: "user-1", message: "Ryan started research on Digital Content Hub platform", type: "update", isRead: true, relatedId: "task-19", createdAt: "2026-07-18T09:00:00Z" },
  { id: "notif-8", userId: "user-1", message: "TBWA workshop contract confirmed — $12,000", type: "update", isRead: true, relatedId: "sale-7", createdAt: "2026-07-01T14:00:00Z" },
];
