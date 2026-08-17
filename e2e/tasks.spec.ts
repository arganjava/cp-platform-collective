import { test, expect } from "@playwright/test";
import { acceptDialogs, loginAsAdmin, unique } from "./helpers";

test.describe("Tasks CRUD", () => {
  test("create, edit, and delete a task", async ({ page }) => {
    acceptDialogs(page);
    await loginAsAdmin(page);

    const title = unique("E2E Task");
    const edited = `${title} (edited)`;

    // Sidebar labels this link "Tasks"; the page heading is "My Tasks".
    await page.getByRole("link", { name: "Tasks" }).click();
    await page.getByRole("heading", { name: "My Tasks", exact: true }).waitFor();

    // ── Create ────────────────────────────────────────────────
    await page.getByRole("button", { name: "New Task" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("What needs to be done?").fill(title);
    // First real project (index 1 skips the "Select project..." placeholder).
    await dialog.locator("select").first().selectOption({ index: 1 });
    await dialog.getByRole("button", { name: "Create Task", exact: true }).click();
    await expect(page.getByText(title, { exact: true })).toBeVisible();

    // ── Edit ──────────────────────────────────────────────────
    await page.getByRole("button", { name: `Edit ${title}`, exact: true }).click();
    const editDialog = page.getByRole("dialog");
    await editDialog.getByPlaceholder("Task title").fill(edited);
    await editDialog.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.getByText(edited, { exact: true })).toBeVisible();

    // ── Delete ────────────────────────────────────────────────
    await page.getByRole("button", { name: `Delete ${edited}`, exact: true }).click();
    await expect(page.getByText(edited, { exact: true })).toHaveCount(0);
  });
});
