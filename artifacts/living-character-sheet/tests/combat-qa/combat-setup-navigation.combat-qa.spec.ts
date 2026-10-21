import { expect, test } from "@playwright/test";

async function gotoAndWait(page: any, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });
}

async function loadDemoCharacter(page: any) {
  await gotoAndWait(page, "/landing");
  await expect(page.getByText("D&D Companion")).toBeVisible();
  await page.getByText("Try demo character (Lyra Shadowstep)").click();
  await expect(page).toHaveURL(/\/(tabs)?\/?$/, { timeout: 10_000 });
}

test.describe("Combat Setup and Navigation QA", () => {
  test("demo character can open battle screen and combat controls render", async ({ page }) => {
    await loadDemoCharacter(page);

    const battleTab = page.getByRole("tab", { name: /Battle/ });
    await expect(battleTab).toBeVisible();
    await battleTab.click();

    await expect(page).toHaveURL(/\/(tabs\/)?attacks(\?|$)/);
    await expect(page.getByText("ATTACKS", { exact: true })).toBeVisible();

    const useAttackButtons = page.getByText("Use Attack", { exact: true });
    await expect(useAttackButtons.first()).toBeVisible();
    const attackButtonCount = await useAttackButtons.count();
    expect(attackButtonCount).toBeGreaterThan(0);

    await page.goto("/party", { waitUntil: "domcontentloaded" });
    const hasPartyCode = await page.getByText("PARTY CODE").isVisible({ timeout: 2_000 }).catch(() => false);
    if (hasPartyCode) {
      await expect(page.getByText("PARTY CODE")).toBeVisible();
    } else {
      await expect(page.getByText("Party View", { exact: true })).toBeVisible();
    }
  });
});
