import { expect, test } from "@playwright/test";

async function gotoAndWait(page: any, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });
}

test.describe("[smoke:adventure] Adventure One-Off Session Smoke", () => {
  test("outcome shell transitions for loot and encounter closure", async ({ page }) => {
    test.slow();
    await gotoAndWait(page, "/landing");
    await expect(page.getByText("D&D Companion")).toBeVisible();
    const demoButton = page.getByText("Try demo character (Lyra Shadowstep)");
    if ((await demoButton.count()) > 0) {
      await demoButton.click();
      await expect(page).toHaveURL(/\/(tabs)?\/?$/);
    }

    await gotoAndWait(
      page,
      "/adventure/session/oneoff-smoke?title=Smoke%20Bridge%20Fight&difficulty=balanced&stylePreset=heroic&guidance=Keep%20it%20tight&startInCombat=1",
    );

    await expect(page.getByText("Adventure Session", { exact: true })).toBeVisible();
    await expect(page.getByText(/(Outcome Shell|One-Off Finale)/, { exact: false })).toBeVisible();
    await expect(page.getByText("Idle", { exact: true })).toBeVisible();
    await expect(page.getByText("Quick Actions", { exact: true })).toBeVisible();

    await page.getByText("Loot Hook", { exact: true }).first().click();
    await expect(page.getByText("Loot Ready", { exact: true })).toBeVisible();
    await expect(page.getByText(/Reward Preview/i)).toBeVisible();

    await page.getByText("End Encounter", { exact: true }).first().click();
    await expect(page.getByText("Encounter Closed", { exact: true })).toBeVisible();
    await expect(page.getByText(/^Closed at\s/i)).toBeVisible();
    await expect(page.getByText("Session Recap", { exact: true })).toBeVisible();
    await expect(page.getByText(/(Handoff Payload \(Bounded\)|Archive Summary)/, { exact: false })).toBeVisible();
    await expect(page.getByText(/Mode: one_off/i)).toBeVisible();
    await expect(page.getByText("Approval Required Before Apply", { exact: true })).toBeVisible();

    await page.getByText("Approve Handoff", { exact: true }).first().click();
    await expect(page.getByText("Handoff Approved (Local)", { exact: true })).toBeVisible();
    await page.getByText(/(Apply Handoff \(Deferred\)|Finish Session(?:\s*&\s*Save Archive)?)/, { exact: false }).first().click();
    await expect(page).toHaveURL(/\/adventure\/sessions/);

    await expect(page.getByText("Saved Sessions", { exact: true })).toBeVisible();
    await expect(page.getByText("Smoke Bridge Fight", { exact: true })).toBeVisible();
    await page.getByText("Clear Journal", { exact: true }).click();
    await expect(page.getByText("Submit journal cleared.", { exact: true })).toBeVisible();
    await expect(page.getByText("No submit attempts recorded yet.", { exact: true })).toBeVisible();
    await page.getByText("Copy Journal", { exact: true }).click();
    await expect(page.getByText("No submit journal entries to copy.", { exact: true })).toBeVisible();
    await page.getByText("Submit to Server", { exact: true }).first().click();
    await expect(page.getByText(/(Submitted|Replay acknowledged) \(oneoff-handoff\.v1\) at/i).first()).toBeVisible();
    await expect(page.getByText("Recent Submit Journal", { exact: true })).toBeVisible();
    await expect(page.getByText(/Showing latest \d+ of \d+ entries\./i, { exact: false }).first()).toBeVisible();
    await page.getByText("Failures", { exact: true }).click();
    await expect(page.getByText("Current filter hides all entries. Change filter to view available history.", { exact: true })).toBeVisible();
    await expect(page.getByText("No submit attempts recorded yet.", { exact: true })).toBeVisible();
    await page.getByText("Copy Journal", { exact: true }).click();
    await expect(page.getByText("No visible submit journal entries for current filter to copy.", { exact: true })).toBeVisible();
    await expect(page.getByText("Show Trace IDs", { exact: true })).toBeVisible();
    await page.getByText("Show Trace IDs", { exact: true }).click();
    await expect(page.getByText("Hide Trace IDs", { exact: true })).toBeVisible();
    await gotoAndWait(page, "/adventure");
    await expect(page.getByText("Diagnostics Context Active", { exact: true })).toBeVisible();
    await page.getByText("Return to Saved Sessions", { exact: true }).click();
    await expect(page).toHaveURL(/\/adventure\/sessions/);
    await expect(page.getByText(/(Locally saved campaign resumes and one-off handoff snapshots\.|Finished one-off finales and campaign resumes saved on this device\.)/, { exact: false })).toBeVisible();
    await gotoAndWait(page, "/adventure/sessions");
    await expect(page.getByText("Return to Saved Sessions", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Hide Trace IDs", { exact: true })).toBeVisible();
    await expect(page.getByText("Current filter hides all entries. Change filter to view available history.", { exact: true })).toBeVisible();
    await page.getByText("All", { exact: true }).click();
    await expect(page.getByText(/oneoff-smoke\s-\ssubmitted/i).first()).toBeVisible();
    await page.getByText("Refresh Journal", { exact: true }).click();
    await expect(page.getByText("Submit journal refreshed.", { exact: true })).toBeVisible();
    await expect(page.getByText(/oneoff-smoke\s-\s(submitted|replay|conflict_in_progress|conflict_payload_mismatch|invalid_payload|failed)/i).first()).toBeVisible();
    await page.getByText("Clear Archive", { exact: true }).click();
    await expect(page.getByText("Submit journal refreshed.", { exact: true })).toBeHidden();
    await expect(page.getByText(/(No Saved One-Off Sessions Yet|No Completed One-Off Sessions Yet)/, { exact: false })).toBeVisible();

    await gotoAndWait(page, "/adventure/new");
    await expect(page.getByText("New Session", { exact: true })).toBeVisible();
    await page.getByText("Start Adventure", { exact: true }).click();
    await expect(page).toHaveURL(/\/adventure\/session\/campaign-/);
    await expect(page.getByText("Character Sheet", { exact: true })).toBeVisible();
    await expect(page.getByText("Your Input", { exact: true })).toBeVisible();
  });
});
