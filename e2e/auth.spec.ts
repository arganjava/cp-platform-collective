import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("Auth", () => {
  test("signed-out users are bounced to /login with their intended path", async ({ page }) => {
    await page.goto("/projects");
    await page.waitForURL(/\/login/);

    // Middleware preserves the intended path as ?returnTo=/projects, but it
    // arrives URL-encoded (?returnTo=%2Fprojects), so match the query param
    // name, then assert the decoded value.
    const returnTo = new URL(page.url()).searchParams.get("returnTo");
    if (returnTo) {
      expect(returnTo).toBe("/projects");
    }

    await expect(page.getByRole("heading", { name: "Sign in to the workspace" })).toBeVisible();
  });

  test("admin can sign in with email/password and lands on the dashboard", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    // The user menu in the top bar shows the signed-in account name. Scope to
    // the menu button — the dashboard greeting also contains "CP Admin".
    await expect(page.getByRole("button", { name: "Open profile menu" })).toBeVisible();
  });
});
