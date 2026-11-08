import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import Server from '../server';

const server = new Server();
const { app } = server;

beforeAll(async () => {
  await server.ready;
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('GET /solar-system/bodies', () => {
  test('returns the Sun and the 8 planets in order', async () => {
    const response = await request(app).get('/solar-system/bodies').expect(200).expect('Content-Type', /json/);
    expect(response.body.map((body: { id: string }) => body.id)).toEqual([
      'sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune',
    ]);
  });

  test('every planet has the fields the client needs', async () => {
    const response = await request(app).get('/solar-system/bodies').expect(200);
    for (const body of response.body) {
      expect(typeof body.name).toBe('string');
      expect(body.diameterKm).toBeGreaterThan(0);
      expect(Array.isArray(body.facts)).toBe(true);
      if (body.id !== 'sun') expect(body.orbitalPeriodDays).toBeGreaterThan(0);
    }
  });
});

describe('GET /solar-system/bodies/:id', () => {
  test('returns one planet, case-insensitive', async () => {
    const response = await request(app).get('/solar-system/bodies/Mars').expect(200);
    expect(response.body.name).toBe('Mars');
    expect(response.body.moons).toBe(2);
  });

  test('returns 404 for an unknown body', async () => {
    const response = await request(app).get('/solar-system/bodies/pluto').expect(404);
    expect(response.body.msg).toMatch(/pluto/);
  });
});
