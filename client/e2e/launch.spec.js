import { expect, fillLaunchForm, test } from "./fixtures";

test.describe.configure({ timeout: 120_000 });

const launch = (page) => page.getByRole("button", { name: /Launch Mission/ }).click();

const countVibrations = (page) =>
  page.addInitScript(() => {
    window.__vibrations = 0;
    navigator.vibrate = () => {
      window.__vibrations += 1;
      return true;
    };
  });

test("an accepted mission flies to orbit and offers a trip to its planet", async ({ page, api }) => {
  await page.goto("/launch");
  await fillLaunchForm(page);
  await launch(page);

  const overlay = page.getByRole("dialog", { name: "Launch of Kepler Pathfinder" });
  await expect(overlay).toBeVisible();
  await expect(overlay.locator(".launch-clock")).toHaveText(/^T-00:0\d$/);

  await expect(overlay.getByRole("heading", { name: "Mission launched" })).toBeVisible({ timeout: 90_000 });
  await expect(overlay).toContainText("as flight #217");
  expect(api.state.created).toHaveLength(1);
  expect(api.state.created[0]).toMatchObject({ mission: "Kepler Pathfinder", destination: "Kepler-452 b" });

  await overlay.getByRole("button", { name: "Fly to Kepler-452 b" }).click();
  await expect(page).toHaveURL(/\/exoplanets\?planet=kepler-452-b$/);
  await expect(page.getByRole("tab", { name: "Kepler-452 b" })).toHaveAttribute("aria-selected", "true");
});

test("the count holds while mission control is slow to answer", async ({ page, api }) => {
  const answer = api.answerLaunchLater(api.json({ flightNumber: 218 }, 201));
  await page.goto("/launch");
  await fillLaunchForm(page, "Slow Answer");
  await launch(page);

  const status = page.getByRole("dialog").locator(".launch-status");
  await expect(status).toHaveText("Hold — waiting for mission control", { timeout: 40_000 });
  await page.waitForTimeout(1500);
  await expect(status).toHaveText("Hold — waiting for mission control");
  answer();
  await expect(status).not.toHaveText(/Hold/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Mission launched" })).toBeVisible({ timeout: 90_000 });
});

test("a rejected mission is scrubbed before ignition with the reasons from the server", async ({ page, api }) => {
  api.answerLaunchWith(api.json({ errors: ["Mission name is required", "Launch date must be in the future"] }, 400));
  await page.goto("/launch");
  await page.getByLabel("Destination Exoplanet").selectOption("Kepler-62 f");
  await launch(page);

  const overlay = page.getByRole("dialog");
  await expect(overlay.getByRole("heading", { name: "Launch scrubbed" })).toBeVisible({ timeout: 15_000 });
  await expect(overlay.locator(".launch-clock")).toHaveText("SCRUB");
  await expect(overlay.getByRole("listitem")).toHaveText(["Mission name is required", "Launch date must be in the future"]);

  await overlay.getByRole("button", { name: "Fix and try again" }).click();
  await expect(overlay).toBeHidden();
});

test("Escape closes the launch view", async ({ page, api }) => {
  await page.goto("/launch");
  await fillLaunchForm(page);
  await launch(page);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  expect(api.state.created).toHaveLength(1);
});

test("the phone vibrates at ignition", async ({ page, api }) => {
  await countVibrations(page);
  await page.goto("/launch");
  await fillLaunchForm(page);
  await launch(page);
  const overlay = page.getByRole("dialog");
  await expect(overlay).toHaveAttribute("data-motion", "full");
  await expect(overlay.locator(".launch-status")).toHaveText(/Liftoff/, { timeout: 40_000 });
  expect(await page.evaluate(() => window.__vibrations)).toBeGreaterThan(0);
});

test.describe("with reduced motion", () => {
  test("the launch skips camera shake and vibration", async ({ page, api }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await countVibrations(page);
    await page.goto("/launch");
    await fillLaunchForm(page);
    await launch(page);
    const overlay = page.getByRole("dialog");
    await expect(overlay).toHaveAttribute("data-motion", "reduced");
    await expect(overlay.locator(".launch-status")).toHaveText(/Liftoff/, { timeout: 40_000 });
    expect(await page.evaluate(() => window.__vibrations)).toBe(0);
  });
});
