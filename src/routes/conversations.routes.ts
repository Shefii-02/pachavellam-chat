import { Router } from 'express';
import { conversationsController } from '../controllers/conversations.controller.js';
import { groupsController } from '../controllers/groups.controller.js';
import { joinLinksController } from '../controllers/joinLinks.controller.js';
import { messagesController } from '../controllers/messages.controller.js';
import { searchController } from '../controllers/search.controller.js';
import { upload } from '../middleware/upload.js';

export const conversationsRouter = Router();

conversationsRouter.get('/', conversationsController.list);
conversationsRouter.post('/', conversationsController.create);
conversationsRouter.get('/:id', conversationsController.get);
conversationsRouter.patch('/:id', groupsController.updateInfo);
conversationsRouter.post('/:id/read', conversationsController.markRead);
conversationsRouter.post('/:id/mute', conversationsController.mute);
conversationsRouter.post('/:id/unmute', conversationsController.unmute);
conversationsRouter.delete('/:id/participants/me', groupsController.leave);

conversationsRouter.get('/:id/members', groupsController.listMembers);
conversationsRouter.post('/:id/members', groupsController.addMembers);
conversationsRouter.patch('/:id/members/:userId', groupsController.updateMember);

conversationsRouter.post('/:id/join-links', joinLinksController.create);
conversationsRouter.get('/:id/join-links', joinLinksController.list);

conversationsRouter.get('/:id/messages', messagesController.list);
conversationsRouter.post('/:id/messages', messagesController.send);
conversationsRouter.post('/:id/messages/media', upload.single('file'), messagesController.sendMedia);
conversationsRouter.get('/:id/search', searchController.inConversation);
