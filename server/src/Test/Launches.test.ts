import { afterAll, describe,expect,test } from '@jest/globals';
import request from 'supertest';
import Server  from '../server';
import mongoose from 'mongoose';

const {app} = new Server();
describe('Get /launches/get', () => {
  test('should return a list of launches', async () => {
    const response = await request(app) 
      .get('/launches/get')
      .expect(200).expect('Content-Type', /json/);
      
  })
});
describe('Post /launches/create', () => {
  test('should create a new launch and return it', async () => {
    const allDataLaunch = {
        mission: "Kepler Exploration",
        rocket: "Falcon 9",
        launchDate: "2025-12-31",
        destination: "TRAPPIST-1d",
        customers: ["SpaceX", "NASA"],
        upcoming: true,
        success: true
      }
    const response = await request(app)
      .post('/launches/create')
      .send(allDataLaunch)
      .expect(201)
      .expect('Content-Type', /json/);
      const allDataNewLaunch = {
        ...allDataLaunch,
        launchDate: new Date(allDataLaunch.launchDate).toISOString(),
      };
    expect(response.body).toMatchObject(allDataNewLaunch);
  });
});
afterAll(async () => {
  await mongoose.connection.close();
});