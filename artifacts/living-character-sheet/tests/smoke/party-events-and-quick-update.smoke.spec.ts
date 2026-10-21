import { expect, test } from "@playwright/test";
import type { QuickUpdateResult } from "../../types/index";

async function gotoAndWait(page: any, path: string) {
  const isPartyRoute = path === "/party";
  const navigationTimeout = isPartyRoute ? 90_000 : 30_000;
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: navigationTimeout });
  await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });
}

async function loadDemoCharacter(page: any) {
  await gotoAndWait(page, "/landing");
  await expect(page.getByText("D&D Companion")).toBeVisible();
  await page.getByText("Try demo character (Lyra Shadowstep)").click();
  await expect(page).toHaveURL(/\/(tabs)?\/?$/, { timeout: 10_000 });
}

test.describe("Party Events and Quick Update Smoke", () => {
  test("party events panel renders and filter toggles do not crash", async ({ page }) => {
    await loadDemoCharacter(page);
    await gotoAndWait(page, "/party");

    const eventsButton = page.getByText("Events", { exact: true }).first();
    const hasEventsSegment = await eventsButton.isVisible({ timeout: 2_000 }).catch(() => false);

    if (hasEventsSegment) {
      await eventsButton.click();

      await expect(page.getByText("Party Event Log")).toBeVisible();
      await expect(page.getByText("RELEVANCE")).toBeVisible();
      await expect(page.getByText("TYPE")).toBeVisible();
      await expect(page.getByText("SOURCE")).toBeVisible();

      await page.getByText("Combat", { exact: true }).first().click();
      await expect(page.getByText("Party Event Log")).toBeVisible();

      await page.getByText("Important", { exact: true }).first().click();
      await expect(page.getByText("Party Event Log")).toBeVisible();

      await page.getByText("Reset", { exact: true }).first().click();
      await expect(page.getByText("Party Event Log")).toBeVisible();
    } else {
      // In environments without a seeded party membership, only the Party shell is available.
      await expect(page.getByText("Party View", { exact: true })).toBeVisible();
    }
  });

  test("quick-update parse preview and apply flow works with deterministic mocked parser", async ({ page }) => {
    test.slow();

    const mockedResult: QuickUpdateResult = {
      rawInput: "Took 5 damage",
      summary: "SMOKE_MOCK_SUMMARY",
      type: "hp",
      proposedInventoryChanges: [],
      proposedResourceChanges: [],
      proposedConditionChanges: [],
      proposedHpChange: {
        delta: -5,
        type: "damage",
      },
      questActions: [],
      personActions: [],
      locationActions: [],
      realmActions: [],
    };

    const mockedQuestResult = {
      summary: "SMOKE_MOCK_SUMMARY",
      questActions: [
        {
          action: "create",
          questId: null,
          name: "Recover the Stolen Charter",
          type: "main",
          status: "active",
          description: "Track thieves and recover the town charter.",
          notes: null,
          locationNames: ["Honordale"],
          personNames: ["Captain Mara"],
        },
      ],
      personActions: [],
      locationActions: [],
      realmActions: [],
    };

    await page.route("**/api/ai/parse-update", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockedResult),
      });
    });

    await page.route("**/api/ai/parse-quest-update", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockedQuestResult),
      });
    });

    await loadDemoCharacter(page);
    await gotoAndWait(page, "/(tabs)/quick-update");

    const input = page.getByPlaceholder("Type a quick update...");
    await expect(input).toBeVisible();
    await input.fill("I took 5 damage.");

    const parseBtn = page.getByText("Parse with AI", { exact: true }).first();
    await parseBtn.click();
    await expect(page.getByText("SMOKE_MOCK_SUMMARY")).toBeVisible({ timeout: 10_000 });

    const journalApplyBtn = page.getByText(/Apply to Journal/i).first();
    const quickApplyBtn = page.getByText(/Apply 1 Change/i).first();

    if (await journalApplyBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await journalApplyBtn.click();
      await expect(page.getByText(/Journal updated!/i)).toBeVisible({ timeout: 8_000 });
    } else {
      await expect(quickApplyBtn).toBeVisible({ timeout: 8_000 });
      await quickApplyBtn.click();
      await expect(page.getByText("Applied", { exact: true })).toBeVisible({ timeout: 8_000 });
    }
  });
});
