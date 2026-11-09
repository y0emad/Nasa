import { Router } from 'express';
import { loadExoplanets } from '../data/exoplanets';

export const createExoplanetsRouter = (csvPath: string) => {
  const router = Router();

  router.get('/all', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=86400');
    res.status(200).json(loadExoplanets(csvPath));
  });

  router.get('/:id', (req, res) => {
    const id = req.params.id.toLowerCase();
    const planet = loadExoplanets(csvPath).find((item) => item.id === id || item.name.toLowerCase() === id);
    if (!planet) {
      return res.status(404).json({ msg: `No habitable exoplanet called ${req.params.id}` });
    }
    res.status(200).json(planet);
  });

  return router;
};
