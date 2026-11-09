import { test as base, expect } from "@playwright/test";

export const PLANETS = [
  { _id: "1", kepler_name: "Kepler-62 f" },
  { _id: "2", kepler_name: "Kepler-452 b" },
];

const star = (name, temperatureK, radiusSun, luminositySun, spectralClass, color) => ({
  name, temperatureK, radiusSun, luminositySun, spectralClass, color,
});

export const EXOPLANETS = [
  {
    id: "kepler-62-f",
    name: "Kepler-62 f",
    orbitalPeriodDays: 267.29,
    radiusEarth: 1.41,
    equilibriumTempK: 208,
    insolationEarth: 0.41,
    orbitAu: 0.728,
    star: star("Kepler-62", 4925, 0.64, 0.217, "K", "#ffe2ca"),
    rightAscensionDeg: 283,
    declinationDeg: 50.2,
    keplerMagnitude: 13.65,
  },
  {
    id: "kepler-452-b",
    name: "Kepler-452 b",
    orbitalPeriodDays: 384.84,
    radiusEarth: 1.55,
    equilibriumTempK: 265,
    insolationEarth: 1.05,
    orbitAu: 1.078,
    star: star("Kepler-452", 5757, 1.11, 1.219, "G", "#fff4ea"),
    rightAscensionDeg: 296,
    declinationDeg: 44.3,
    keplerMagnitude: 13.43,
  },
];

const inDays = (days) => new Date(Date.now() + days * 86_400_000).toISOString();

export const LAUNCHES = [
  {
    flightNumber: 90, mission: "Discoverer 18", rocket: "Thor DM-21 Agena-B", launchDate: "1960-12-07T00:00:00.000Z",
    destination: "Low Earth Orbit", customers: ["USAF"], upcoming: false, success: true,
  },
  {
    flightNumber: 101, mission: "Kepler Pathfinder", rocket: "Explorer IS1", launchDate: inDays(40),
    destination: "Kepler-452 b", customers: ["NASA"], upcoming: true, success: true,
  },
];

export const SPACE_TODAY = {
  source: "epic",
  date: "2026-11-06",
  title: "The whole Earth, seen from deep space",
  explanation: "NASA's EPIC camera on the DSCOVR spacecraft took this picture.",
  mediaType: "image",
  url: "/img/background-small.webp",
  hdUrl: null,
  thumbnailUrl: null,
  copyright: null,
  sourceUrl: "https://epic.gsfc.nasa.gov",
};

const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

export const test = base.extend({
  lowPower: [true, { option: true }],
  page: async ({ page, lowPower }, use) => {
    if (lowPower) {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 2 });
      });
    }
    await use(page);
  },
  api: async ({ page }, use) => {
    const state = { spaceToday: json(SPACE_TODAY), createLaunch: null, created: [] };
    await page.route("**/planets/get", (route) => route.fulfill(json(PLANETS)));
    await page.route("**/launches/get", (route) => route.fulfill(json(LAUNCHES)));
    await page.route("**/exoplanets/all", (route) => route.fulfill(json(EXOPLANETS)));
    await page.route("**/space-today", (route) => route.fulfill(state.spaceToday));
    await page.route("**/launches/create", async (route) => {
      state.created.push(route.request().postDataJSON());
      const answer = state.createLaunch ?? { delay: 300, response: json({ flightNumber: 217 }, 201) };
      if (answer.gate) await answer.gate;
      else await new Promise((resolve) => setTimeout(resolve, answer.delay));
      await route.fulfill(answer.response);
    });
    await use({
      state,
      json,
      answerLaunchWith: (response, delay = 300) => {
        state.createLaunch = { response, delay };
      },
      answerLaunchLater: (response) => {
        let release;
        const gate = new Promise((resolve) => {
          release = resolve;
        });
        state.createLaunch = { response, gate };
        return release;
      },
      spaceTodayFails: () => {
        state.spaceToday = json({ msg: "not available" }, 502);
      },
    });
  },
});

export const fillLaunchForm = async (page, mission = "Kepler Pathfinder") => {
  await page.getByLabel("Mission Name").fill(mission);
  await page.getByLabel("Destination Exoplanet").selectOption("Kepler-452 b");
};

export { expect };
