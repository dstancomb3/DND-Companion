import { expect, test } from "@playwright/test";

test("[smoke:adventure] Balanced workspace stacks on phones without losing the input draft", async ({ page }) => {
  test.slow();
  // Presentation fixture only: no model calls or shared party mutations.
  await page.route("**/api/**", route => route.fulfill({
    status: 503, contentType: "application/json", body: JSON.stringify({ error: "Workspace fixture: backend unavailable" }),
  }));
  await page.addInitScript(() => {
    localStorage.setItem("@lcs_app_settings", JSON.stringify({ showDevLandingDemoContent: true }));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/landing", { timeout: 90_000 });
  await page.getByText("Try demo character (Lyra Shadowstep)").click();
  await expect(page).toHaveURL(/\/(tabs)?\/?$/);
  await page.goto("/adventure/session/workspace-smoke?title=Workspace%20fixture", { timeout: 90_000 });
  await expect(page.getByTestId("adventure-workspace")).toBeVisible();
  const party = page.getByTestId("workspace-party");
  const story = page.getByTestId("workspace-narrative");
  const actions = page.getByTestId("workspace-actions");
  const encounter = page.getByTestId("workspace-encounter");
  await expect.poll(async () => {
    const p = await party.boundingBox(), s = await story.boundingBox(), a = await actions.boundingBox(), e = await encounter.boundingBox();
    return !!(p && s && a && e && p.x < s.x && s.x < e.x && a.y > s.y);
  }).toBe(true);
  const input = page.getByPlaceholder("Tell the DM what you do next");
  await input.fill("I inspect the door");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(input).toHaveValue("I inspect the door");
  await expect.poll(async () => {
    const s = await story.boundingBox(), a = await actions.boundingBox();
    return !!(s && a && s.width <= 390 && a.y >= s.y + s.height - 1);
  }).toBe(true);
  await input.scrollIntoViewIfNeeded();
  await expect(input).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(input).toHaveValue("I inspect the door");
  for (const id of ["party", "inventory", "narrative", "actions", "encounter", "events"]) {
    await expect(page.getByTestId(`workspace-${id}`)).toHaveCount(1);
  }
});
