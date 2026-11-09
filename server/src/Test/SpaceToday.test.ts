import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import axios from 'axios';
import request from 'supertest';
import mongoose from 'mongoose';
import Server from '../server';
import { resetSpaceTodayCache } from '../router/SpaceTodayRouter';

const server = new Server();
const { app } = server;

const APOD = {
  date: '2026-11-09',
  title: 'The Pillars of Creation',
  explanation: 'Towers of gas and dust in the Eagle Nebula.',
  media_type: 'image',
  url: 'https://apod.nasa.gov/apod/image/2611/pillars_1024.jpg',
  hdurl: 'https://apod.nasa.gov/apod/image/2611/pillars.jpg',
  copyright: '\nJane Doe\n',
};

const EPIC = [
  {
    image: 'epic_1b_20261106002712',
    date: '2026-11-06 00:22:24',
    centroid_coordinates: { lat: -8.2251, lon: 159.9243 },
    dscovr_j2000_position: { x: -1248604.9, y: -764665.0, z: -208251.1 },
  },
];

type Answer = { data: unknown } | Error;

const mockNasa = (answers: { apod?: Answer; epic?: Answer }) =>
  jest.spyOn(axios, 'get').mockImplementation((async (url: string) => {
    const answer = url.includes('api.nasa.gov') ? answers.apod : answers.epic;
    if (!answer || answer instanceof Error) throw answer ?? new Error('not mocked');
    return answer;
  }) as typeof axios.get);

beforeAll(async () => {
  await server.ready;
});

beforeEach(() => {
  resetSpaceTodayCache();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('GET /space-today', () => {
  test('returns the Astronomy Picture of the Day in a clean shape', async () => {
    mockNasa({ apod: { data: APOD } });
    const response = await request(app).get('/space-today').expect(200);
    expect(response.body).toEqual({
      source: 'apod',
      date: '2026-11-09',
      title: 'The Pillars of Creation',
      explanation: 'Towers of gas and dust in the Eagle Nebula.',
      mediaType: 'image',
      url: APOD.url,
      hdUrl: APOD.hdurl,
      thumbnailUrl: null,
      copyright: 'Jane Doe',
      sourceUrl: 'https://apod.nasa.gov/apod/ap261109.html',
    });
    expect(response.headers['cache-control']).toContain('max-age=1800');
  });

  test('falls back to the latest EPIC picture of Earth when APOD is down', async () => {
    mockNasa({ apod: new Error('503'), epic: { data: EPIC } });
    const response = await request(app).get('/space-today').expect(200);
    expect(response.body.source).toBe('epic');
    expect(response.body.date).toBe('2026-11-06');
    expect(response.body.url).toBe(
      'https://epic.gsfc.nasa.gov/archive/natural/2026/11/06/jpg/epic_1b_20261106002712.jpg',
    );
    expect(response.body.explanation).toContain('1,479,000 km');
    expect(response.body.url).not.toContain('api_key');
  });

  test('asks NASA only once while the cached picture is fresh', async () => {
    const get = mockNasa({ apod: { data: APOD } });
    await request(app).get('/space-today').expect(200);
    await request(app).get('/space-today').expect(200);
    expect(get).toHaveBeenCalledTimes(1);
  });

  test('returns 502 when both NASA sources fail and nothing is cached', async () => {
    mockNasa({ apod: new Error('timeout'), epic: new Error('timeout') });
    const response = await request(app).get('/space-today').expect(502);
    expect(response.body.msg).toMatch(/not available/);
  });

  test('treats an APOD answer without a url as a failure', async () => {
    mockNasa({ apod: { data: { title: 'No media' } }, epic: { data: [] } });
    await request(app).get('/space-today').expect(502);
  });
});
