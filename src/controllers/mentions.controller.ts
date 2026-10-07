import type { NextFunction, Request, Response } from 'express';
import { participantsRepository } from '../db/repositories/participants.repository.js';
import { conversationService } from '../services/conversationService.js';
import { mentionsAutocompleteQuerySchema } from '../utils/validation.js';

export const mentionsController = {
  async autocomplete(req: Request, res: Response, next: NextFunction) {
    try {
      const query = mentionsAutocompleteQuerySchema.parse(req.query);
      await conversationService.assertActiveParticipant(query.conversation_id, req.userId!);

      const rows = await participantsRepository.searchActiveParticipants({
        conversationId: query.conversation_id,
        query: query.q,
        excludeUserId: req.userId!,
        limit: 10,
      });

      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
};
