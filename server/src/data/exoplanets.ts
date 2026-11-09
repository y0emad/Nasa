import fs from 'fs';

export interface Exoplanet {
  id: string;
  name: string;
  orbitalPeriodDays: number;
  radiusEarth: number;
  equilibriumTempK: number;
  insolationEarth: number;
  orbitAu: number;
  star: {
    name: string;
    temperatureK: number;
    radiusSun: number;
    luminositySun: number;
    spectralClass: string;
    color: string;
  };
  rightAscensionDeg: number;
  declinationDeg: number;
  keplerMagnitude: number;
}

type Row = Record<string, string>;

export const isHabitable = (row: { koi_disposition?: string; koi_insol?: string }) => {
  const insolation = parseFloat(row.koi_insol ?? '');
  return row.koi_disposition === 'CONFIRMED' && insolation > 0.36 && insolation < 1.11;
};

const SUN_TEMPERATURE_K = 5772;

const STAR_COLORS: [number, [number, number, number]][] = [
  [3000, [255, 177, 110]],
  [4000, [255, 206, 159]],
  [5000, [255, 228, 206]],
  [5800, [255, 245, 236]],
  [6500, [255, 254, 250]],
  [7500, [227, 233, 255]],
];

const hex = (rgb: number[]) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;

export const starColor = (temperatureK: number) => {
  if (temperatureK <= STAR_COLORS[0][0]) return hex(STAR_COLORS[0][1]);
  for (let i = 1; i < STAR_COLORS.length; i++) {
    const [t1, c1] = STAR_COLORS[i];
    const [t0, c0] = STAR_COLORS[i - 1];
    if (temperatureK <= t1) {
      const k = (temperatureK - t0) / (t1 - t0);
      return hex(c0.map((c, j) => c + (c1[j] - c) * k));
    }
  }
  return hex(STAR_COLORS[STAR_COLORS.length - 1][1]);
};

export const spectralClass = (temperatureK: number) => {
  if (temperatureK < 3900) return 'M';
  if (temperatureK < 5300) return 'K';
  if (temperatureK < 6000) return 'G';
  if (temperatureK < 7300) return 'F';
  return 'A';
};

const round = (value: number, digits: number) => Number(value.toFixed(digits));

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const toExoplanet = (row: Row): Exoplanet => {
  const name = row.kepler_name.trim();
  const temperatureK = Number(row.koi_steff);
  const radiusSun = Number(row.koi_srad);
  const insolation = Number(row.koi_insol);
  const luminosity = radiusSun * radiusSun * Math.pow(temperatureK / SUN_TEMPERATURE_K, 4);
  return {
    id: slug(name),
    name,
    orbitalPeriodDays: round(Number(row.koi_period), 2),
    radiusEarth: Number(row.koi_prad),
    equilibriumTempK: Number(row.koi_teq),
    insolationEarth: insolation,
    orbitAu: round(Math.sqrt(luminosity / insolation), 3),
    star: {
      name: name.replace(/\s+[a-z]$/, ''),
      temperatureK,
      radiusSun,
      luminositySun: round(luminosity, 3),
      spectralClass: spectralClass(temperatureK),
      color: starColor(temperatureK),
    },
    rightAscensionDeg: Number(row.ra),
    declinationDeg: Number(row.dec),
    keplerMagnitude: Number(row.koi_kepmag),
  };
};

export const parseExoplanets = (csv: string): Exoplanet[] => {
  const [header, ...lines] = csv.trim().split(/\r?\n/);
  const columns = header.split(',');
  const seen = new Set<string>();
  const planets: Exoplanet[] = [];
  for (const line of lines) {
    const values = line.split(',');
    const row: Row = Object.fromEntries(columns.map((column, i) => [column, values[i] ?? '']));
    const name = row.kepler_name?.trim();
    if (!name || !isHabitable(row) || seen.has(name)) continue;
    seen.add(name);
    planets.push(toExoplanet(row));
  }
  return planets.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
};

const cache = new Map<string, Exoplanet[]>();

export const loadExoplanets = (filePath: string): Exoplanet[] => {
  if (!cache.has(filePath)) {
    cache.set(filePath, parseExoplanets(fs.readFileSync(filePath, 'utf8')));
  }
  return cache.get(filePath)!;
};
