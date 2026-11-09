import { expect, test } from "./fixtures";

test("the exoplanet explorer shows each planet and sends you to schedule a mission", async ({ page, api }) => {
  await page.goto("/exoplanets");
  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveText(["Kepler-62 f", "Kepler-452 b"]);
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("canvas")).toBeVisible();

  await page.getByRole("tab", { name: "Kepler-452 b" }).click();
  await expect(page).toHaveURL(/planet=kepler-452-b/);
  const stats = page.getByRole("table");
  await expect(stats).toContainText("1.55 × Earth");
  await expect(stats).toContainText("G-type Sun-like star");
  await expect(stats).toContainText("1.05 – 1.84 AU");

  await page.getByRole("button", { name: "Close-up" }).click();
  await expect(page.getByRole("button", { name: "Close-up" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Schedule a mission here" }).click();
  await expect(page).toHaveURL(/\/launch\?destination=Kepler-452%20b$/);
  await expect(page.getByLabel("Destination Exoplanet")).toHaveValue("Kepler-452 b");
});

test("an unknown planet in the link falls back to the first one", async ({ page, api }) => {
  await page.goto("/exoplanets?planet=kepler-22-b");
  await expect(page.getByRole("tab", { name: "Kepler-62 f" })).toHaveAttribute("aria-selected", "true");
});

test("upcoming missions count down and can be watched again", async ({ page, api }) => {
  test.setTimeout(120_000);
  await page.goto("/upcoming");
  const countdown = page.getByTestId("countdown");
  await expect(countdown).toHaveText(/^T-(39|40)d \d{2}:\d{2}:\d{2}$/);
  const first = await countdown.textContent();
  await expect(countdown).not.toHaveText(first);

  await page.getByRole("button", { name: "Watch the launch of flight 101" }).click();
  const overlay = page.getByRole("dialog", { name: "Launch of Kepler Pathfinder" });
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText("Flight #101");
  await expect(overlay.getByRole("heading", { name: "Launch replay complete" })).toBeVisible({ timeout: 90_000 });
  await expect(overlay.getByRole("button", { name: "Schedule another" })).toHaveCount(0);
  expect(api.state.created).toHaveLength(0);
});

test("the launch page shows the NASA picture of the day", async ({ page, api }) => {
  await page.goto("/launch");
  const section = page.getByRole("region", { name: "The whole Earth, seen from deep space" });
  await expect(section).toBeVisible();
  await expect(section).toContainText("NASA EPIC camera · 2026-11-06");
  await expect(section.getByRole("link", { name: "More from EPIC" })).toHaveAttribute("href", "https://epic.gsfc.nasa.gov");
});

test("the launch page still works when the NASA picture is not available", async ({ page, api }) => {
  api.spaceTodayFails();
  await page.goto("/launch");
  await expect(page.getByRole("button", { name: /Launch Mission/ })).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(page.getByText("Today from NASA")).toHaveCount(0);
});
