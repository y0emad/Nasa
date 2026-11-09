import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import mongoose from 'mongoose';
import Server from '../server';

const server = new Server();
const { app } = server;
const assets = path.join(__dirname, '..', '..', 'public', 'assets');
const hasBuild = fs.existsSync(assets);

beforeAll(async () => {
  await server.ready;
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('responses', () => {
  test('JSON is compressed when the browser accepts gzip', async () => {
    const response = await request(app).get('/solar-system/bodies').set('Accept-Encoding', 'gzip').expect(200);
    expect(response.headers['content-encoding']).toBe('gzip');
  });
});

(hasBuild ? describe : describe.skip)('the built client', () => {
  test('hashed assets are cached for a year', async () => {
    const file = fs.readdirSync(assets).find((name) => name.endsWith('.js'));
    const response = await request(app).get(`/assets/${file}`).expect(200);
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  test('client routes get index.html that is never cached', async () => {
    const response = await request(app).get('/exoplanets').set('Accept', 'text/html').expect(200);
    expect(response.headers['content-type']).toMatch(/html/);
    expect(response.headers['cache-control']).toBe('no-cache');
  });
});
