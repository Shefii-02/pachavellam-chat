import type { NextFunction, Request, Response } from 'express';
import { messageService } from '../services/messageService.js';
import { clampLimit } from '../utils/pagination.js';
import { searchQuerySchema } from '../utils/validation.js';

export const searchController = {
  async inConversation(req: Request, res: Response, next: NextFunction) {
    try {
      const query = searchQuerySchema.parse(req.query);
      const result = await messageService.search(req.userId!, query.q, {
        conversationId: Number(req.params.id),
        limit: clampLimit(query.limit, 50),
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async global(req: Request, res: Response, next: NextFunction) {
    try {
      const query = searchQuerySchema.parse(req.query);
      const result = await messageService.search(req.userId!, query.q, { limit: clampLimit(query.limit, 50) });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};
