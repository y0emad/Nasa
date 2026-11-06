import { body, param, query } from 'express-validator';
import Planet from '../models/Planet';

const startOfToday = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

export const createLaunchValidator = [
  body('mission').isString().trim().notEmpty().withMessage('Mission is required'),
  body('rocket').isString().trim().notEmpty().withMessage('Rocket is required'),
  body('launchDate')
    .isISO8601()
    .withMessage('Launch date must be a valid date')
    .bail()
    .custom((value) => {
      if (new Date(value) < startOfToday()) throw new Error('Launch date cannot be in the past');
      return true;
    }),
  body('destination')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Destination is required')
    .bail()
    .custom(async (value) => {
      const exists = await Planet.exists({ kepler_name: value });
      if (!exists) throw new Error('Destination must be one of the habitable planets');
      return true;
    }),
];

export const deleteLaunchValidator = [
  param('flightNumber').isInt().withMessage('Flight number must be an integer'),
];

export const updateLaunchValidator = [
  param('flightNumber').isInt().withMessage('Flight number must be an integer'),
];

export const getLaunchPageValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
];
