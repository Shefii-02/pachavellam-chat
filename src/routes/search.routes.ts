import { Router } from 'express';
import { searchController } from '../controllers/search.controller.js';
import { mentionsController } from '../controllers/mentions.controller.js';

export const searchRouter = Router();

searchRouter.get('/search', searchController.global);
searchRouter.get('/mentions/autocomplete', mentionsController.autocomplete);
