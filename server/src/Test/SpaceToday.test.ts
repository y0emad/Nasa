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

const SCIENCE_POSTS = [
  {
    slug: 'hubble-image-of-the-week',
    date: '2026-11-10T10:00:00',
    link: 'https://science.nasa.gov/image-article/hubble-image-of-the-week/',
    title: { rendered: 'Hubble image of the week' },
    content: { rendered: '<p>Not an APOD</p>' },
    featured_media: 7,
  },
  {
    slug: 'apod-2026-november-10-saturn-behind-the-moon',
    date: '2026-11-10T00:05:00',
    link: 'https://science.nasa.gov/image-article/apod-2026-november-10-saturn-behind-the-moon/',
    title: { rendered: 'APOD: 2026 November 10 &#8211; Saturn Behind the Moon' },
    content: {
      rendered:
        '<p class="x"> <strong>Explanation:</strong> Sometimes <a href="#">Saturn</a> disappears. It doesn&#8217;t really go away &amp; returns. <br><br><strong>Tomorrow&#8217;s picture: </strong>small</p>' +
        '<table><tr><th scope="row">Credit &amp; Copyright</th> <td class="p-sm"> <a href="#">Roberto Ortu</a> </td></tr></table>',
    },
    featured_media: 1509573,
  },
];

const SCIENCE_IMAGE = 'https://assets.science.nasa.gov/dynamicimage/assets/science/cds/apod/apod/2026/november/Moonsaturn.jpg';

type Answer = { data: unknown } | Error;

const mockNasa = (answers: { science?: Answer; media?: Answer; apod?: Answer; epic?: Answer }) =>
  jest.spyOn(axios, 'get').mockImplementation((async (url: string) => {
    const answer = url.includes('/image-article')
      ? answers.science
      : url.includes('/media/')
        ? answers.media
        : url.includes('api.nasa.gov')
          ? answers.apod
          : answers.epic;
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
  test("returns today's APOD from NASA Science, skipping posts that are not APOD", async () => {
    mockNasa({ science: { data: SCIENCE_POSTS }, media: { data: { source_url: SCIENCE_IMAGE } } });
    const response = await request(app).get('/space-today').expect(200);
    expect(response.body).toEqual({
      source: 'apod',
      date: '2026-11-10',
      title: 'Saturn Behind the Moon',
      explanation: 'Sometimes Saturn disappears. It doesn’t really go away & returns.',
      mediaType: 'image',
      url: `${SCIENCE_IMAGE}?w=1280&h=1280&fit=clip`,
      hdUrl: SCIENCE_IMAGE,
      thumbnailUrl: `${SCIENCE_IMAGE}?w=600&h=600&fit=clip`,
      copyright: 'Roberto Ortu',
      sourceUrl: 'https://science.nasa.gov/image-article/apod-2026-november-10-saturn-behind-the-moon/',
    });
    expect(response.headers['cache-control']).toContain('max-age=1800');
  });

  test('uses the APOD API when NASA Science has no APOD post', async () => {
    mockNasa({ science: { data: [SCIENCE_POSTS[0]] }, apod: { data: APOD } });
    const response = await request(app).get('/space-today').expect(200);
    expect(response.body.title).toBe('The Pillars of Creation');
  });

  test('uses the APOD API when NASA Science is down', async () => {
    mockNasa({ science: new Error('timeout'), apod: { data: APOD } });
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
    const get = mockNasa({ science: { data: SCIENCE_POSTS }, media: { data: { source_url: SCIENCE_IMAGE } } });
    await request(app).get('/space-today').expect(200);
    await request(app).get('/space-today').expect(200);
    expect(get).toHaveBeenCalledTimes(2);
  });

  test('returns 502 when every NASA source fails and nothing is cached', async () => {
    mockNasa({ apod: new Error('timeout'), epic: new Error('timeout') });
    const response = await request(app).get('/space-today').expect(502);
    expect(response.body.msg).toMatch(/not available/);
  });

  test('treats an APOD answer without a url as a failure', async () => {
    mockNasa({ apod: { data: { title: 'No media' } }, epic: { data: [] } });
    await request(app).get('/space-today').expect(502);
  });
});
