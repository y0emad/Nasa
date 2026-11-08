import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import path from 'path';
import PlanetsRouter from './router/PlanetsRouter';
import LaunchRouter from './router/LaunchRouter';
import SolarSystemRouter from './router/SolarSystemRouter';
import { loadLaunchData, loadPlanetsData } from './middleWare/middleWare';

const clientBuild = path.join(__dirname, '..', 'public');
const defaultCsv = path.join(process.cwd(), 'src', 'data', 'kepler_data_cleaned.csv');

class server {
  public app: express.Application = express();
  public ready: Promise<void>;

  constructor() {
    this.middlewares();
    this.routes();
    this.serveClient();
    this.notFoundHandler();
    this.errorHandler();
    this.ready = this.start();
  }

  private middlewares(): void {
    this.app.use(cors({ origin: process.env.CORS_API_ORIGIN }));
    this.app.use(express.json({ limit: '20kb' }));
  }

  private async start(): Promise<void> {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/Nasa');
      console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
      console.error(`MongoDB Connection Error: ${error}`);
      return;
    }
    if (process.env.NODE_ENV === 'test') return;
    await loadLaunchData();
    await loadPlanetsData(process.env.CSV_DIR || defaultCsv);
  }

  private routes() {
    this.app.use('/planets', PlanetsRouter);
    this.app.use('/launches', LaunchRouter);
    this.app.use('/solar-system', SolarSystemRouter);
  }

  private serveClient() {
    this.app.get('/', (_req, res) => res.redirect('/launch'));
    this.app.use(express.static(clientBuild));
  }

  private notFoundHandler() {
    this.app.use((req, res, next) => {
      if (req.method === 'GET' && req.accepts('html')) {
        return res.sendFile(path.join(clientBuild, 'index.html'), (err) => err && next());
      }
      next();
    });
    this.app.use((req, res) => {
      res.status(404).json({ msg: `Route ${req.method} ${req.originalUrl} not found` });
    });
  }

  private errorHandler() {
    this.app.use((err: { type?: string; status?: number }, _req: Request, res: Response, _next: NextFunction) => {
      if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ msg: 'Invalid JSON body' });
      }
      if (err.type === 'entity.too.large') {
        return res.status(413).json({ msg: 'Request body is too large' });
      }
      console.error(err);
      res.status(500).json({ msg: 'Something went wrong, please try again' });
    });
  }
}

export default server;
