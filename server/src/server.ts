import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import PlanetsRouter from './router/PlanetsRouter';
import LaunchRouter from './router/LaunchRouter';
import {loadLaunchData , loadPlanetsData} from './middleWare/middleWare';
class server {
 
 public app: express.Application = express();
  constructor() {
    this.setConfig();
    this.routes();
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

  error404Handler() {
    this.app.use((req, res) => {
      res.status(404).json({ msg: 'Route not found' });
    });}
}

export default server;
