import { Request, Response } from 'express';
import Launch from '../models/Launch';

const FIRST_FLIGHT_NUMBER = 101;
const MAX_CREATE_RETRIES = 3;

const isDuplicateKey = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;

export class LaunchController {
  static async getLaunchesPagination(req: Request, res: Response) {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      const total = await Launch.countDocuments();
      const totalPages = Math.ceil(total / limit);

      if (totalPages > 0 && page > totalPages) {
        return res.status(404).json({ msg: 'Page not found' });
      }

      const launches = await Launch.find({}).sort({ flightNumber: 1 }).skip(skip).limit(limit);
      res.status(200).json({
        launches,
        prevPage: page > 1 ? page - 1 : null,
        nextPage: page < totalPages ? page + 1 : null,
        currentPage: page,
        totalPages,
        limit,
      });
    } catch (error) {
      res.status(500).json({ msg: 'Error fetching launches' });
    }
  }

  static async getAllLaunches(_req: Request, res: Response) {
    try {
      const launches = await Launch.find({}).sort({ flightNumber: 1 });
      res.status(200).json(launches);
    } catch (error) {
      res.status(500).json({ msg: 'Error fetching launches' });
    }
  }

  static async createLaunch(req: Request, res: Response) {
    const { mission, rocket, launchDate, destination, customers } = req.body;

    for (let attempt = 1; attempt <= MAX_CREATE_RETRIES; attempt++) {
      try {
        const latest = await Launch.findOne().sort({ flightNumber: -1 }).select('flightNumber');
        const flightNumber = Math.max((latest?.flightNumber ?? 0) + 1, FIRST_FLIGHT_NUMBER);
        const launch = await Launch.create({
          flightNumber,
          mission,
          rocket,
          launchDate,
          destination,
          customers,
          upcoming: true,
          success: true,
        });
        return res.status(201).json(launch);
      } catch (error) {
        if (isDuplicateKey(error) && attempt < MAX_CREATE_RETRIES) continue;
        return res.status(500).json({ msg: 'Error creating launch' });
      }
    }
  }

  static async deleteLaunch(req: Request, res: Response) {
    try {
      const launch = await Launch.findOneAndDelete({ flightNumber: Number(req.params.flightNumber) });
      if (!launch) {
        return res.status(404).json({ msg: 'Launch not found' });
      }
      res.status(200).json({ msg: 'Launch deleted successfully' });
    } catch (error) {
      res.status(500).json({ msg: 'Error deleting launch' });
    }
  }

  static async updateLaunch(req: Request, res: Response) {
    try {
      const launch = await Launch.findOneAndUpdate(
        { flightNumber: Number(req.params.flightNumber) },
        { success: false, upcoming: false },
        { returnDocument: 'after' }
      );

      if (!launch) {
        return res.status(404).json({ msg: 'Launch not found' });
      }

      res.status(200).json(launch);
    } catch (error) {
      res.status(500).json({ msg: 'Error updating launch' });
    }
  }
}
