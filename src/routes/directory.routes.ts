import { Router } from 'express';
import { groupsController } from '../controllers/groups.controller.js';
import { joinLinksController } from '../controllers/joinLinks.controller.js';

export const directoryRouter = Router();

directoryRouter.get('/directory', groupsController.directory);
directoryRouter.post('/directory/:id/join', groupsController.selfJoin);

directoryRouter.get('/join/:token', joinLinksController.preview);
directoryRouter.post('/join/:token', joinLinksController.consume);
directoryRouter.delete('/join-links/:token', joinLinksController.revoke);
