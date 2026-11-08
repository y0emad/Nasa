import { Router } from 'express';
import { solarSystem } from '../data/solarSystem';

const router = Router();

router.get('/bodies', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=86400');
  res.status(200).json(solarSystem);
});

router.get('/bodies/:id', (req, res) => {
  const body = solarSystem.find((item) => item.id === req.params.id.toLowerCase());
  if (!body) {
    return res.status(404).json({ msg: `No solar system body called ${req.params.id}` });
  }
  res.status(200).json(body);
});

export default router;
