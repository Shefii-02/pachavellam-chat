import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { messageService } from '../services/messageService.js';
import { badRequest } from '../middleware/errorHandler.js';
import { isExtensionAllowed, saveChatMedia } from '../utils/mediaStorage.js';
import { clampLimit } from '../utils/pagination.js';
import {
  forwardSchema,
  listMessagesQuerySchema,
  reactionSchema,
  sendMediaMessageSchema,
  sendMessageSchema,
} from '../utils/validation.js';
import { broadcastNewMessage, broadcastReactionUpdated } from '../sockets/index.js';

export const messagesController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listMessagesQuerySchema.parse(req.query);
      const result = await messageService.listForConversation(
        Number(req.params.id),
        req.userId!,
        { cursor: query.cursor, limit: clampLimit(query.limit) },
        env.publicMediaBaseUrl
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async send(req: Request, res: Response, next: NextFunction) {
    try {
      const body = sendMessageSchema.parse(req.body);
      const message = await messageService.sendText(
        Number(req.params.id),
        req.userId!,
        body.body,
        body.reply_to_message_id
      );
      broadcastNewMessage(message);
      res.status(201).json({ message });
    } catch (err) {
      next(err);
    }
  },

  async sendMedia(req: Request, res: Response, next: NextFunction) {
    try {
      const conversationId = Number(req.params.id);
      const file = req.file;
      if (!file) throw badRequest('No file was uploaded');

      const body = sendMediaMessageSchema.parse(req.body);
      if (!isExtensionAllowed(body.type, file.originalname)) {
        throw badRequest(`File extension not allowed for type "${body.type}"`);
      }

      const { diskPath } = await saveChatMedia({
        conversationId,
        originalFilename: file.originalname,
        buffer: file.buffer,
      });

      const message = await messageService.sendMedia({
        conversationId,
        senderId: req.userId!,
        type: body.type,
        caption: body.caption,
        replyToMessageId: body.reply_to_message_id,
        attachment: {
          diskPath,
          originalFilename: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          durationSeconds: body.duration_seconds,
          width: body.width,
          height: body.height,
        },
        publicMediaBaseUrl: env.publicMediaBaseUrl,
      });

      broadcastNewMessage(message);
      res.status(201).json({ message });
    } catch (err) {
      next(err);
    }
  },

  async setReaction(req: Request, res: Response, next: NextFunction) {
    try {
      const body = reactionSchema.parse(req.body);
      const { conversationId, reactions } = await messageService.setReaction(Number(req.params.id), req.userId!, body.emoji);
      broadcastReactionUpdated(conversationId, Number(req.params.id), reactions);
      res.json({ reactions });
    } catch (err) {
      next(err);
    }
  },

  async removeReaction(req: Request, res: Response, next: NextFunction) {
    try {
      const { conversationId, reactions } = await messageService.removeReaction(Number(req.params.id), req.userId!);
      broadcastReactionUpdated(conversationId, Number(req.params.id), reactions);
      res.json({ reactions });
    } catch (err) {
      next(err);
    }
  },

  async forward(req: Request, res: Response, next: NextFunction) {
    try {
      const body = forwardSchema.parse(req.body);
      const messages = await messageService.forward(
        Number(req.params.id),
        req.userId!,
        body.target_conversation_ids,
        env.publicMediaBaseUrl
      );
      for (const message of messages) broadcastNewMessage(message);
      res.status(201).json({ messages });
    } catch (err) {
      next(err);
    }
  },
};
