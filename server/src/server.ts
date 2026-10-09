import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import path from 'path';
import PlanetsRouter from './router/PlanetsRouter';
import LaunchRouter from './router/LaunchRouter';
import {loadLaunchData , loadPlanetsData} from './middleWare/middleWare';

const clientBuild = path.join(__dirname, '..', 'public');
class server {
 
 public app: express.Application = express();
  constructor() {
    this.setConfig();
    this.routes();
    this.serveClient();
    this.error404Handler();
    
  }
  private setConfig(){
    this.middlewares();
    this.connectToDB()
    this.loadData() }
    

private middlewares(): void {
  this.app.use(cors({ origin: process.env.CORS_API_ORIGIN }));
  this.app.use(express.json());
}
 
  private async connectToDB() {
    try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/Nasa');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error}`);
    
  }
}
private async  loadData() {
 await loadLaunchData();
 await loadPlanetsData(process.env.CSV_DIR!);

}

  routes() {
    this.app.use('/planets', PlanetsRouter);
    this.app.use('/launches', LaunchRouter);
    
  }
  private serveClient() {
  
    this.app.get('/', (req, res) => res.redirect('/launch'));

    this.app.use(express.static(clientBuild));
  }

  error404Handler() {
    this.app.use((req, res) => {
      if (req.method === 'GET' && req.accepts('html')) {
        return res.sendFile(path.join(clientBuild, 'index.html'));
      }
      res.status(404).json({ msg: 'Route not found' });
    });
  }
}

export default server;
