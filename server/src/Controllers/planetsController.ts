import { Request, Response } from 'express';
import Planet from '../models/Planet';

export class planetsController {
  static async getAllPlanets(_req: Request, res: Response) {
    try {
      const planets = await Planet.find().sort({ kepler_name: 1 });
      res.status(200).json(planets);
    } catch (error) {
      res.status(500).json({ msg: 'Error fetching planets' });
    }
  }
}
