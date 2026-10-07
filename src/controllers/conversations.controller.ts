import type { NextFunction, Request, Response } from 'express';
import { conversationService } from '../services/conversationService.js';
import { participantsRepository } from '../db/repositories/participants.repository.js';
import { clampLimit } from '../utils/pagination.js';
import { createConversationSchema, listConversationsQuerySchema, markReadSchema, muteSchema } from '../utils/validation.js';
import { broadcastConversationNew } from '../sockets/index.js';

export const conversationsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listConversationsQuerySchema.parse(req.query);
      const result = await conversationService.listForUser(req.userId!, {
        cursor: query.cursor,
        limit: clampLimit(query.limit),
        search: query.search,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const conversation = await conversationService.getForUser(Number(req.params.id), req.userId!);
      res.json({ conversation });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createConversationSchema.parse(req.body);

      const conversation =
        body.type === 'individual'
          ? await conversationService.createIndividual(req.userId!, body.participant_user_ids[0])
          : await conversationService.createGroup(req.userId!, {
              type: body.type,
              name: body.name,
              description: body.description,
              courseId: body.course_id,
              isPublic: body.is_public,
              participantUserIds: body.participant_user_ids,
            });

      const participantIds = await participantsRepository.activeUserIds(conversation.id);
      broadcastConversationNew(conversation, participantIds.filter((id) => id !== req.userId));

      res.status(201).json({ conversation });
    } catch (err) {
      next(err);
    }
  },

  async markRead(req: Request, res: Response, next: NextFunction) {
    try {
      const body = markReadSchema.parse(req.body);
      await conversationService.markRead(Number(req.params.id), req.userId!, body.last_read_message_id);
      res.json({ message: 'Marked as read' });
    } catch (err) {
      next(err);
    }
  },

  async mute(req: Request, res: Response, next: NextFunction) {
    try {
      const body = muteSchema.parse(req.body);
      await conversationService.setMute(Number(req.params.id), req.userId!, body.minutes ?? null);
      res.json({ message: 'Muted' });
    } catch (err) {
      next(err);
    }
  },

  async unmute(req: Request, res: Response, next: NextFunction) {
    try {
      await conversationService.unmute(Number(req.params.id), req.userId!);
      res.json({ message: 'Unmuted' });
    } catch (err) {
      next(err);
    }
  },
};
