import { Router } from 'express';
import { messagesController } from '../controllers/messages.controller.js';

export const messagesRouter = Router();

messagesRouter.post('/:id/reactions', messagesController.setReaction);
messagesRouter.delete('/:id/reactions', messagesController.removeReaction);
messagesRouter.post('/:id/forward', messagesController.forward);
