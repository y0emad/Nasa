import axios from "axios";
import Launch from "../models/Launch";
import fs from "fs";
import path from "path";
import csv from "csv-parser";
import Planet from "../models/Planet";
import { isHabitable } from "../data/exoplanets";

interface KOIRow {
  kepler_name: string;
  koi_disposition: string;
  koi_insol: string;
}

export async function loadLaunchData(): Promise<void> {
  try {
    if ((await Launch.countDocuments()) > 0) {
      console.log("Launch data already loaded!");
      return;
    }

    const apiUrl = process.env.GET_LAUNCHES_API;
    if (!apiUrl) {
      console.warn("GET_LAUNCHES_API is not set, skipping the launch data import.");
      return;
    }

    console.log("Fetching launch data from SpaceDevs API...");
    const response = await axios.get(apiUrl, {
      params: { limit: 100 },
      timeout: 15000,
    });

    const launchDocs = response.data.results;

    const launches = launchDocs.map((launch: any, index: number) => ({
    
      flightNumber: launch.orbital_launch_attempt_count || launch.agency_launch_attempt_count || (index + 1),
      mission: launch.mission?.name || launch.name,
      rocket: launch.rocket?.configuration?.name || "Falcon 9",
      launchDate: new Date(launch.net),
      destination: launch.mission?.orbit?.name || "Low Earth Orbit",
      customers: [launch.launch_service_provider?.name || "SpaceX"],
      upcoming: launch.status?.id === 1 || launch.status?.id === 2,
      success: launch.status?.id === 3
    }));
   
    if(launches.length > 0) {
        await Launch.insertMany(launches, { ordered: false });
        return console.log("Launch data loaded successfully!");
    }else {
        console.log("No launch data found to load.");
    }
      } catch (error) {
        console.error("Failed to fetch or save launch data:", error);
      }
    }

function parseCSV(filePath: string): Promise<KOIRow[]> {
  return new Promise((resolve, reject) => {
    const results: KOIRow[] = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row: KOIRow) => {
        if (isHabitable(row)) {
          results.push(row);
        }
      })
      .on("end", () => resolve(results))
      .on("error", reject);
  });
}

export async function loadPlanetsData(filePath: string): Promise<void> {
  try {
    const existing = await Planet.countDocuments();
    if (existing > 0) {
      console.log("Planet data already loaded!");
      return;
    }

    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`CSV file not found at: ${resolvedPath}`);
    }

    console.log("Loading planet data from CSV...");
    const habitablePlanets = await parseCSV(resolvedPath);
   
    
    const names = new Set(
      habitablePlanets.map((row) => row.kepler_name?.trim()).filter((name): name is string => Boolean(name))
    );
    const planets = [...names].map((kepler_name) => ({ kepler_name }));
    if (planets.length > 0) {
       await Planet.insertMany(planets, { ordered: false });
      
      console.log(`Loaded ${planets.length} habitable planets.`);
    } else {
      console.log("No habitable planets found in CSV.");
    }
  } catch (error) {
    console.error("Failed to load planet data:", error);
  }
}