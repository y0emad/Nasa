import { expect, test } from "./fixtures";

const PAGES = ["/launch", "/upcoming", "/history", "/exoplanets"];

for (const path of PAGES) {
  test(`${path} fits a phone screen with the tab bar`, async ({ page, api }) => {
    await page.goto(path);
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link")).toHaveCount(5);
    await expect(nav.getByRole("link", { name: "Exoplanets" })).toBeVisible();
    await page.waitForTimeout(1500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("tapping a tab moves between pages", async ({ page, api }) => {
  await page.goto("/launch");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Exoplanets" }).click();
  await expect(page).toHaveURL(/\/exoplanets/);
  await expect(page.getByRole("tab", { name: "Kepler-62 f" })).toBeVisible();
});
