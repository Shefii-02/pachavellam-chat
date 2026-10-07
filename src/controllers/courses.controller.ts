import type { NextFunction, Request, Response } from 'express';
import { coursesRepository } from '../db/repositories/courses.repository.js';

export const coursesController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;
      const items = await coursesRepository.list(q);
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
};
