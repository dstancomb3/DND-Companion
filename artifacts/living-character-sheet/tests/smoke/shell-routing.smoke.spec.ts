import { expect, test } from "@playwright/test";

async function gotoAndWait(page: any, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });
}

test.describe("Shell & Routing Smoke", () => {
  test("landing to player shell and primary tabs", async ({ page }) => {
    await gotoAndWait(page, "/landing");
    await expect(page.getByText("D&D Companion")).toBeVisible();

    await page.getByText("Try demo character (Lyra Shadowstep)").click();
    await expect(page).toHaveURL(/\/(tabs)?\/?$/);

    await expect(page.getByRole("tab", { name: /Character/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Battle/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Inventory/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Notes/ })).toBeVisible();

    // Party should no longer be a primary tab label.
    await expect(page.getByText(/^Party$/)).toHaveCount(0);
  });

  test("party route compatibility and events redirect", async ({ page }) => {
    await gotoAndWait(page, "/party");
    await expect(page.getByText("Party View", { exact: true })).toBeVisible();

    await page.goto("/party-events", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/party(\?|$)/);
    await expect(page.getByText("Party View", { exact: true })).toBeVisible();
  });

  test("dm shell mounts only on dm routes", async ({ page }) => {
    await gotoAndWait(page, "/dm-notes");
    await expect(page.getByText("Show DM Menu", { exact: true })).toBeVisible();

    await gotoAndWait(page, "/landing");
    await expect(page.getByText("Show DM Menu", { exact: true })).toHaveCount(0);
  });

  test("direct dm routes load", async ({ page }) => {
    await gotoAndWait(page, "/dm-party");
    await expect(page.getByText("DM Party View")).toBeVisible();

    await gotoAndWait(page, "/dm-notes");
    await expect(page.getByText("DM Notes", { exact: true })).toBeVisible();

    await gotoAndWait(page, "/dm-npc");
    await expect(page.getByText("NPC Creator")).toBeVisible();

    await gotoAndWait(page, "/dm-item");
    await expect(page.getByText("Item Creator")).toBeVisible();

    await gotoAndWait(page, "/dm-monsters");
    await expect(page.getByText("Monster Compendium")).toBeVisible();
  });

  test("utility/demoted routes load", async ({ page }) => {
    await gotoAndWait(page, "/(tabs)/quick-update");
    await expect(page).toHaveURL(/quick-update/);
    await expect(page.getByText("Quest Log Update")).toBeVisible();

    await gotoAndWait(page, "/(tabs)/resources");
    await expect(page).toHaveURL(/resources/);
    await expect(page.getByText("Short Rest", { exact: true })).toBeVisible();

    await gotoAndWait(page, "/(tabs)/log");
    await expect(page).toHaveURL(/log/);
    await expect(page.getByText("New Session")).toBeVisible();
  });
});
