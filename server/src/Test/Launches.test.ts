import { afterAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import Server from '../server';

const { app } = new Server();

const futureDate = new Date();
futureDate.setFullYear(futureDate.getFullYear() + 1);

const TEST_MISSION = 'Jest Test Mission';

describe('GET /launches/get', () => {
  test('returns a list of launches', async () => {
    const response = await request(app)
      .get('/launches/get')
      .expect(200)
      .expect('Content-Type', /json/);

    expect(Array.isArray(response.body)).toBe(true);
  });
});

describe('POST /launches/create', () => {
  const launch = {
    mission: TEST_MISSION,
    rocket: 'Falcon 9',
    launchDate: futureDate.toISOString(),
    destination: 'TRAPPIST-1d',
    customers: ['SpaceX', 'NASA'],
    upcoming: true,
    success: true,
  };

  test('creates a new launch and returns it', async () => {
    const response = await request(app)
      .post('/launches/create')
      .send(launch)
      .expect(201)
      .expect('Content-Type', /json/);

    expect(response.body).toMatchObject(launch);
  });

 
});

afterAll(async () => {
  // Clean up what the tests created (adjust the collection name to yours)
  await mongoose.connection
    .collection('launches')
    .deleteMany({ mission: TEST_MISSION });
  await mongoose.connection.close();
});