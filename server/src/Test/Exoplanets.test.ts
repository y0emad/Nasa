import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import Server from '../server';
import { parseExoplanets, spectralClass, starColor } from '../data/exoplanets';

const server = new Server();
const { app } = server;

beforeAll(async () => {
  await server.ready;
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('GET /exoplanets/all', () => {
  test('returns the confirmed habitable planets once each, sorted by name', async () => {
    const response = await request(app).get('/exoplanets/all').expect(200).expect('Content-Type', /json/);
    const names = response.body.map((planet: { name: string }) => planet.name);
    expect(names).toEqual([
      'Kepler-62 e',
      'Kepler-62 f',
      'Kepler-283 c',
      'Kepler-296 e',
      'Kepler-296 f',
      'Kepler-442 b',
      'Kepler-452 b',
    ]);
  });

  test('every planet has its star and the numbers the 3D view needs', async () => {
    const response = await request(app).get('/exoplanets/all').expect(200);
    for (const planet of response.body) {
      expect(planet.radiusEarth).toBeGreaterThan(0);
      expect(planet.orbitalPeriodDays).toBeGreaterThan(0);
      expect(planet.orbitAu).toBeGreaterThan(0);
      expect(planet.insolationEarth).toBeGreaterThan(0.36);
      expect(planet.insolationEarth).toBeLessThan(1.11);
      expect(planet.star.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(planet.star.name).toBe(planet.name.replace(/ [a-z]$/, ''));
    }
  });
});

describe('GET /exoplanets/:id', () => {
  test('finds a planet by id or by name', async () => {
    const byId = await request(app).get('/exoplanets/kepler-452-b').expect(200);
    expect(byId.body.star.spectralClass).toBe('G');
    expect(byId.body.orbitAu).toBeCloseTo(1.08, 1);
    const byName = await request(app).get(`/exoplanets/${encodeURIComponent('Kepler-62 f')}`).expect(200);
    expect(byName.body.id).toBe('kepler-62-f');
  });

  test('returns 404 for a planet that is not in the list', async () => {
    await request(app).get('/exoplanets/kepler-22-b').expect(404);
  });
});

describe('the /exoplanets page', () => {
  test('a browser opening /exoplanets does not get the API', async () => {
    const response = await request(app).get('/exoplanets').set('Accept', 'application/json');
    expect(response.status).toBe(404);
  });
});

describe('exoplanet helpers', () => {
  test('skips unconfirmed, too hot and unnamed rows', () => {
    const csv = [
      'kepler_name,koi_disposition,koi_insol,koi_steff,koi_srad,koi_period,koi_prad,koi_teq,ra,dec,koi_kepmag',
      'Kepler-1 b,CONFIRMED,0.9,5000,0.8,200,1.2,260,280,40,14',
      'Kepler-2 b,CANDIDATE,0.9,5000,0.8,200,1.2,260,280,40,14',
      'Kepler-3 b,CONFIRMED,4.0,5000,0.8,200,1.2,260,280,40,14',
      ',CONFIRMED,0.9,5000,0.8,200,1.2,260,280,40,14',
    ].join('\n');
    expect(parseExoplanets(csv).map((planet) => planet.name)).toEqual(['Kepler-1 b']);
  });

  test('star class and colour follow the temperature', () => {
    expect(spectralClass(3500)).toBe('M');
    expect(spectralClass(5772)).toBe('G');
    expect(starColor(2500)).toBe('#ffb16e');
    expect(starColor(9000)).toBe('#e3e9ff');
  });
});
