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

test("upcoming missions count down to their launch", async ({ page, api }) => {
  await page.goto("/upcoming");
  const future = page.getByRole("row", { name: /Kepler Pathfinder/ }).getByTestId("countdown");
  await expect(future).toHaveText(/^T-(39|40)d \d{2}:\d{2}:\d{2}$/);
  const first = await future.textContent();
  await expect(future).not.toHaveText(first);
  await expect(page.getByRole("row", { name: /Deep Reach/ }).getByTestId("countdown")).toHaveText("Window open");
});

test("watching a mission that has not launched shows it on the pad", async ({ page, api }) => {
  await page.goto("/upcoming");
  await page.getByRole("button", { name: "Watch the launch of flight 101" }).click();
  const overlay = page.getByRole("dialog", { name: "Launch of Kepler Pathfinder" });
  await expect(overlay).toHaveAttribute("data-mode", "pad", { timeout: 30_000 });
  await expect(overlay.locator(".launch-clock")).toHaveText(/^T-(39|40)d \d{2}:\d{2}:\d{2}$/);
  await expect(overlay.locator(".launch-status")).toHaveText("On the pad — waiting for the launch window");
  await expect(overlay.getByRole("heading", { name: "Waiting for launch" })).toBeVisible();
  await page.waitForTimeout(3000);
  await expect(overlay.locator(".launch-status")).toHaveText("On the pad — waiting for the launch window");
  expect(api.state.created).toHaveLength(0);

  await overlay.getByRole("button", { name: "See Kepler-452 b" }).click();
  await expect(page).toHaveURL(/\/exoplanets\?planet=kepler-452-b$/);
});

test("watching a mission whose date has passed joins it in flight", async ({ page, api }) => {
  await page.goto("/upcoming");
  await page.getByRole("button", { name: "Watch the launch of flight 99" }).click();
  const overlay = page.getByRole("dialog", { name: "Launch of Deep Reach" });
  await expect(overlay).toHaveAttribute("data-mode", "cruise", { timeout: 30_000 });
  await expect(overlay.locator(".launch-clock")).toHaveText(/^T\+3d \d{2}:\d{2}:\d{2}$/);
  await expect(overlay.locator(".launch-status")).toHaveText("Spacecraft en route to Kepler-62 f");
  await expect(overlay.getByRole("heading", { name: "In flight" })).toBeVisible();
  await expect(overlay.getByRole("button", { name: /Skip/ })).toHaveCount(0);
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
