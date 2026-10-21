import { expect, test } from "@playwright/test";

async function gotoAndWait(page: any, path: string) {
  const isPartyRoute = path === "/party";
  const navigationTimeout = isPartyRoute ? 90_000 : 60_000;
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: navigationTimeout });
  await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });
}

async function loadDemoCharacter(page: any) {
  await gotoAndWait(page, "/landing");
  await expect(page.getByText("D&D Companion")).toBeVisible();
  await page.getByText("Try demo character (Lyra Shadowstep)").click();
  await expect(page).toHaveURL(/\/(tabs)?\/?$/, { timeout: 10_000 });
}

test.describe("Core Surface Smoke", () => {
  test("app boots and core player navigation surfaces open", async ({ page }) => {
    test.slow();
    await loadDemoCharacter(page);

    const characterTab = page.getByRole("tab", { name: /Character/ });
    const battleTab = page.getByRole("tab", { name: /Battle/ });
    const inventoryTab = page.getByRole("tab", { name: /Inventory/ });
    const notesTab = page.getByRole("tab", { name: /Notes/ });

    await expect(characterTab).toBeVisible();
    await expect(battleTab).toBeVisible();
    await expect(inventoryTab).toBeVisible();
    await expect(notesTab).toBeVisible();

    await characterTab.click();
    await expect(page).toHaveURL(/\/(tabs)?\/?$/);
    await expect(page.getByText("Lyra Shadowstep")).toBeVisible();

    await battleTab.click();
    await expect(page).toHaveURL(/\/(tabs\/)?attacks(\?|$)/);

    await inventoryTab.click();
    await expect(page).toHaveURL(/\/(tabs\/)?inventory(\?|$)/);

    await notesTab.click();
    await expect(page).toHaveURL(/\/(tabs\/)?notes(\?|$)/);

    await gotoAndWait(page, "/party");
    await expect(page.getByText("Party View", { exact: true })).toBeVisible();
  });
});
