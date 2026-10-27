import { expect, test } from "@playwright/test";

test("[smoke:adventure] directly resize, swap, replace and restore workspace", async ({ page }) => {
  test.slow();
  await page.addInitScript(() => localStorage.setItem("@lcs_app_settings", JSON.stringify({ showDevLandingDemoContent: true })));
  await page.route("**/api/**", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Presentation fixture" }) }));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/landing", { timeout: 90_000 });
  await page.getByText("Try demo character (Lyra Shadowstep)").click();
  await expect(page).toHaveURL(/\/(tabs)?\/?$/);
  await page.goto("/adventure/session/customization-smoke?title=Workspace%20fixture", { timeout: 90_000 });
  const click = (name: string) => page.getByRole("button", { name, exact: true }).click();
  const box = async (id: string) => {
    const rect = await page.getByTestId(`workspace-${id}`).boundingBox();
    expect(rect).not.toBeNull();
    return rect!;
  };
  await expect(page.getByRole("button", { name: "Customize layout" })).toHaveCount(0);
  const input = page.getByPlaceholder("Tell the DM what you do next");
  await input.fill("I examine the door");
  const before = await box("narrative");
  const edge = page.getByLabel("Resize left column", { exact: true });
  const rect = await edge.boundingBox();
  expect(rect).not.toBeNull();
  const x = rect!.x + rect!.width / 2, y = rect!.y + 60;
  const probe = await page.evaluate(({ x, y }) => {
    const divider = document.querySelector('[aria-label="Resize left column"]');
    const hit = document.elementFromPoint(x, y);
    const events: string[] = [];
    for (const type of ["pointerdown", "pointermove", "mousedown", "mousemove"]) {
      document.addEventListener(type, event => {
        const target = event.target as HTMLElement | null;
        events.push(`${type}:${target?.getAttribute("aria-label") ?? target?.tagName ?? "unknown"}`);
      }, { capture: true });
    }
    (window as any).__workspaceDragEvents = events;
    return { dividerExists: !!divider, dividerRect: divider?.getBoundingClientRect().toJSON(),
      hitTag: hit?.tagName, hitLabel: hit?.getAttribute("aria-label"),
      hitElement: hit?.outerHTML.slice(0, 400),
      hitText: hit?.textContent?.slice(0, 280),
      hitAncestors: Array.from((function*() { let node = hit; for(let i=0; node && i<5;i++, node=node.parentElement) yield node; })())
        .map(node => ({tag:node.tagName, label:node.getAttribute("aria-label"),
          className:node.className, zIndex:getComputedStyle(node).zIndex, pointerEvents:getComputedStyle(node).pointerEvents})),
      dividerStyle: divider ? {zIndex:getComputedStyle(divider).zIndex, pointerEvents:getComputedStyle(divider).pointerEvents,
        position:getComputedStyle(divider).position} : null };
  }, { x, y });
  console.log("Workspace drag geometry", JSON.stringify(probe));
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 45, y, { steps: 8 });
  console.log("Workspace drag events", JSON.stringify(await page.evaluate(() => (window as any).__workspaceDragEvents)));
  await expect.poll(async () => (await box("narrative")).width).toBeLessThan(before.width);
  await page.mouse.up();
  const resized = (await box("narrative")).width;
  await page.reload();
  await expect.poll(async () => (await box("narrative")).width).toBe(resized);
  await click("Replace with Character Summary");
  await expect(page.getByTestId("workspace-inventory")).toContainText("Character Summary");
  await click("Move Party");
  await click("Swap with Event log");
  await expect.poll(async () => (await box("party")).x).toBeGreaterThan((await box("narrative")).x);
  await page.reload();
  await expect(page.getByTestId("workspace-inventory")).toContainText("Character Summary");
  await expect.poll(async () => (await box("party")).x).toBeGreaterThan((await box("narrative")).x);
  await expect(input).toBeVisible();
  await input.fill("Keep this draft on mobile");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(input).toHaveValue("Keep this draft on mobile");
});
