import { test, expect } from "@playwright/test";
import { acceptDialogs, loginAsAdmin, unique } from "./helpers";

test.describe("Sales CRUD", () => {
  test("log, edit, and delete a sale", async ({ page }) => {
    acceptDialogs(page);
    await loginAsAdmin(page);

    const client = unique("E2E Client");

    await page.getByRole("link", { name: "Sales" }).click();
    await page.getByRole("heading", { name: "Sales", exact: true }).waitFor();

    // ── Create ────────────────────────────────────────────────
    await page.getByRole("button", { name: "Log Sale" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("e.g., National Arts Council").fill(client);
    await dialog.getByPlaceholder("0.00").fill("1234.50");
    await dialog.locator("select").nth(0).selectOption("commission");
    // First real project (index 1 skips the "Select project..." placeholder).
    await dialog.locator("select").nth(1).selectOption({ index: 1 });
    await dialog.getByRole("button", { name: "Log Sale", exact: true }).click();
    await expect(page.getByText(client, { exact: true })).toBeVisible();

    // ── Edit amount ───────────────────────────────────────────
    await page.getByRole("button", { name: `Edit sale from ${client}`, exact: true }).click();
    const editDialog = page.getByRole("dialog");
    await editDialog.getByPlaceholder("0.00").fill("9999");
    await editDialog.getByRole("button", { name: "Save changes", exact: true }).click();
    // Scope to the table — the summary cards also show dollar amounts.
    await expect(page.locator("tbody").getByText("$9,999", { exact: true })).toBeVisible();

    // ── Delete ────────────────────────────────────────────────
    await page.getByRole("button", { name: `Delete sale from ${client}`, exact: true }).click();
    await expect(page.getByText(client, { exact: true })).toHaveCount(0);
  });
});
