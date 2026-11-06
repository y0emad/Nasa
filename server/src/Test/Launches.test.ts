import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import Server from '../server';
import Planet from '../models/Planet';

const server = new Server();
const { app } = server;

const TEST_MISSION = 'Jest Test Mission';
const TEST_PLANET = 'Kepler-JEST-1 b';

const futureDate = new Date();
futureDate.setFullYear(futureDate.getFullYear() + 1);

const validLaunch = {
  mission: TEST_MISSION,
  rocket: 'Falcon 9',
  launchDate: futureDate.toISOString(),
  destination: TEST_PLANET,
  customers: ['SpaceX', 'NASA'],
};

beforeAll(async () => {
  await server.ready;
  await Planet.updateOne({ kepler_name: TEST_PLANET }, { kepler_name: TEST_PLANET }, { upsert: true });
});

afterAll(async () => {
  await mongoose.connection.collection('launches').deleteMany({ mission: TEST_MISSION });
  await Planet.deleteOne({ kepler_name: TEST_PLANET });
  await mongoose.connection.close();
});

describe('GET /launches/get', () => {
  test('returns a list of launches', async () => {
    const response = await request(app).get('/launches/get').expect(200).expect('Content-Type', /json/);
    expect(Array.isArray(response.body)).toBe(true);
  });
});

describe('GET /launches/getLaunchesPage', () => {
  test('returns a page with pagination info', async () => {
    const response = await request(app).get('/launches/getLaunchesPage?page=1&limit=2').expect(200);
    expect(response.body.currentPage).toBe(1);
    expect(response.body.limit).toBe(2);
    expect(response.body.launches.length).toBeLessThanOrEqual(2);
    expect(response.body.prevPage).toBeNull();
  });

  test('rejects an invalid page number', async () => {
    const response = await request(app).get('/launches/getLaunchesPage?page=0').expect(400);
    expect(response.body.errors).toContain('Page must be a positive integer');
  });
});

describe('POST /launches/create', () => {
  test('creates a new launch and returns it', async () => {
    const response = await request(app)
      .post('/launches/create')
      .send(validLaunch)
      .expect(201)
      .expect('Content-Type', /json/);

    expect(response.body).toMatchObject({ ...validLaunch, upcoming: true, success: true });
    expect(typeof response.body.flightNumber).toBe('number');
  });

  test('gives each new launch the next flight number', async () => {
    const first = await request(app).post('/launches/create').send(validLaunch).expect(201);
    const second = await request(app).post('/launches/create').send(validLaunch).expect(201);
    expect(second.body.flightNumber).toBe(first.body.flightNumber + 1);
  });

  test('rejects a destination that is not a habitable planet', async () => {
    const response = await request(app)
      .post('/launches/create')
      .send({ ...validLaunch, destination: 'Mars' })
      .expect(400);
    expect(response.body.errors).toContain('Destination must be one of the habitable planets');
  });

  test.each([
    [{ mission: '   ' }, 'Mission is required'],
    [{ rocket: '' }, 'Rocket is required'],
    [{ launchDate: 'not a date' }, 'Launch date must be a valid date'],
    [{ launchDate: '2000-01-01' }, 'Launch date cannot be in the past'],
  ])('rejects %p with 400', async (change, message) => {
    const response = await request(app)
      .post('/launches/create')
      .send({ ...validLaunch, ...change })
      .expect(400);
    expect(response.body.errors).toContain(message);
  });

  test('returns 400 JSON for a malformed body', async () => {
    const response = await request(app)
      .post('/launches/create')
      .set('Content-Type', 'application/json')
      .send('{"mission":')
      .expect(400);
    expect(response.body.msg).toBe('Invalid JSON body');
  });
});

describe('PUT /launches/update/:flightNumber', () => {
  test('aborts a launch', async () => {
    const created = await request(app).post('/launches/create').send(validLaunch).expect(201);
    const response = await request(app).put(`/launches/update/${created.body.flightNumber}`).expect(200);
    expect(response.body).toMatchObject({ upcoming: false, success: false });
  });

  test('returns 404 for a launch that does not exist', async () => {
    await request(app).put('/launches/update/999999999').expect(404);
  });
});

describe('unknown API routes', () => {
  test('return a JSON 404', async () => {
    const response = await request(app).post('/launches/nothing').expect(404);
    expect(response.body.msg).toBe('Route POST /launches/nothing not found');
  });
});
