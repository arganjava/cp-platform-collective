import { test, expect } from "@playwright/test";
import { acceptDialogs, loginAsAdmin, unique } from "./helpers";

test.describe("Projects CRUD", () => {
  test("create, edit, and delete a project", async ({ page }) => {
    acceptDialogs(page);
    await loginAsAdmin(page);

    const name = unique("E2E Project");
    const edited = `${name} (edited)`;

    await page.getByRole("link", { name: "Projects" }).click();
    await page.getByRole("heading", { name: "Projects", exact: true }).waitFor();

    // ── Create ────────────────────────────────────────────────
    await page.getByRole("button", { name: "New Project" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("e.g., DARE Festival 2027").fill(name);
    await dialog.getByPlaceholder("Brief description of the project...").fill("Created by Playwright e2e");
    await dialog.getByRole("button", { name: "Create Project", exact: true }).click();
    // exact:true — the Edit/Delete buttons' aria-labels contain the title.
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();

    // ── Edit ──────────────────────────────────────────────────
    await page.getByRole("button", { name: `Edit ${name}`, exact: true }).click();
    const editDialog = page.getByRole("dialog");
    await editDialog.getByPlaceholder("e.g., DARE Festival 2027").fill(edited);
    await editDialog.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.getByRole("button", { name: edited, exact: true })).toBeVisible();

    // ── Delete ────────────────────────────────────────────────
    await page.getByRole("button", { name: `Delete ${edited}`, exact: true }).click();
    await expect(page.getByRole("button", { name: edited, exact: true })).toHaveCount(0);
  });
});
