import type { Page } from "@playwright/test";

/**
 * Credentials for the password-based admin account provisioned by
 * supabase/admin-user.sql. Override via env vars when you rotate the
 * password (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD).
 */
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@collectivep.com";
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "CPAdmin2026!";

/** Accept every window.confirm dialog — delete flows use window.confirm. */
export function acceptDialogs(page: Page) {
  page.on("dialog", (dialog) => dialog.accept());
}

/** Unique suffix so reruns never collide with leftovers in the DB. */
export function unique(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

/**
 * Sign in with the provisioned admin account and wait for the app shell.
 * The global search input only renders once hydration has completed.
 */
export async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  // exact:true is required — the form's aria-label ("Sign in with email and
  // password") contains "Password", so a substring label match would hit both.
  await page.getByLabel("Workspace email", { exact: true }).fill(ADMIN_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in with email", exact: true }).click();
  // The app shell's global search input only renders once hydration completes.
  await page.getByLabel("Search tasks and projects").waitFor({ timeout: 30_000 });
}
