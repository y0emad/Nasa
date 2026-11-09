const API_URL = "";

async function getJson(path, fallback) {
  try {
    const response = await fetch(`${API_URL}${path}`);
    if (!response.ok) return fallback;
    return await response.json();
  } catch {
    return fallback;
  }
}

async function httpGetPlanets() {
  const planets = await getJson("/planets/get", []);
  return Array.isArray(planets) ? planets : [];
}

async function httpGetLaunches() {
  const launches = await getJson("/launches/get", []);
  if (!Array.isArray(launches)) return [];
  return launches.sort((a, b) => a.flightNumber - b.flightNumber);
}

async function httpSubmitLaunch(launch) {
  try {
    return await fetch(`${API_URL}/launches/create`, {
      method: "post",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(launch),
    });
  } catch {
    return {
      ok: false,
    };
  }
}

async function httpAbortLaunch(id) {
  try {
    return await fetch(`${API_URL}/launches/update/${id}`, {
      method: "put",
    });
  } catch {
    return {
      ok: false,
    };
  }
}

async function httpGetSolarSystem() {
  const response = await fetch(`${API_URL}/solar-system/bodies`);
  if (!response.ok) throw new Error(`Solar system request failed: ${response.status}`);
  return await response.json();
}

async function httpGetExoplanets() {
  const response = await fetch(`${API_URL}/exoplanets/all`);
  if (!response.ok) throw new Error(`Exoplanet request failed: ${response.status}`);
  return await response.json();
}

async function httpGetSpaceToday() {
  const picture = await getJson("/space-today", null);
  return picture && typeof picture.url === "string" ? picture : null;
}

export {
  httpGetExoplanets,
  httpGetSpaceToday,
  httpGetPlanets,
  httpGetLaunches,
  httpSubmitLaunch,
  httpAbortLaunch,
  httpGetSolarSystem,
};
