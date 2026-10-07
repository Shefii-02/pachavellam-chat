import type { NextFunction, Request, Response } from 'express';
import { joinLinkService } from '../services/joinLinkService.js';
import { createJoinLinkSchema } from '../utils/validation.js';

export const joinLinksController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createJoinLinkSchema.parse(req.body);
      const link = await joinLinkService.create(Number(req.params.id), req.userId!, {
        expiresAt: body.expires_at,
        maxUses: body.max_uses,
      });
      res.status(201).json({ link });
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const links = await joinLinkService.list(Number(req.params.id), req.userId!);
      res.json({ items: links });
    } catch (err) {
      next(err);
    }
  },

  async revoke(req: Request, res: Response, next: NextFunction) {
    try {
      await joinLinkService.revoke(req.params.token, req.userId!);
      res.json({ message: 'Join link revoked' });
    } catch (err) {
      next(err);
    }
  },

  async preview(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await joinLinkService.preview(req.params.token);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async consume(req: Request, res: Response, next: NextFunction) {
    try {
      const conversation = await joinLinkService.consume(req.params.token, req.userId!);
      res.json({ conversation });
    } catch (err) {
      next(err);
    }
  },
};
