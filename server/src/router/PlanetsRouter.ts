import { Router } from 'express';
import { planetsController } from '../Controllers/planetsController';

class PlanetsRouter {
  public router: Router;

  constructor() {
    this.router = Router();
    this.router.get('/get', planetsController.getAllPlanets);
  }
}

export default new PlanetsRouter().router;
