import { Router } from 'express';
import { authenticateHttp } from '../middleware/authenticateHttp.js';
import { conversationsRouter } from './conversations.routes.js';
import { coursesRouter } from './courses.routes.js';
import { directoryRouter } from './directory.routes.js';
import { messagesRouter } from './messages.routes.js';
import { searchRouter } from './search.routes.js';

export const apiRouter = Router();

apiRouter.use(authenticateHttp);
apiRouter.use('/conversations', conversationsRouter);
apiRouter.use('/messages', messagesRouter);
apiRouter.use('/', searchRouter);
apiRouter.use('/', directoryRouter);
apiRouter.use('/', coursesRouter);
