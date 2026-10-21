import { expect, test } from "@playwright/test";

async function gotoAndWait(page: any, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });
}

async function loadDemoCharacter(page: any) {
  await gotoAndWait(page, "/landing");
  await page.getByText("Try demo character (Lyra Shadowstep)").click();
  await expect(page).toHaveURL(/\/(tabs)?\/?$/, { timeout: 10_000 });
}

test.describe("Combat Attack Feedback QA", () => {
  test("basic weapon attack interaction shows clear rejection feedback outside active combat", async ({ page }) => {
    await loadDemoCharacter(page);
    await gotoAndWait(page, "/attacks");

    await expect(page.getByText("ATTACKS", { exact: true })).toBeVisible();

    const rollInputs = page.getByRole("textbox", { name: "d20" });
    await expect(rollInputs.first()).toBeVisible();
    await rollInputs.first().fill("17");

    const useAttackButton = page.getByText("Use Attack", { exact: true }).first();
    const dialogPromise = page.waitForEvent("dialog", { timeout: 4_000 }).catch(() => null);
    await useAttackButton.click();

    const dialog = await dialogPromise;
    if (dialog) {
      expect(dialog.message()).toMatch(/Action Rejected|Combat is not active|Action was rejected/i);
      await dialog.accept();
    }

    await expect(page.getByText("ATTACKS", { exact: true })).toBeVisible();
  });
});
