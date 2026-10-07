import { Router } from 'express';
import { coursesController } from '../controllers/courses.controller.js';

export const coursesRouter = Router();

coursesRouter.get('/courses', coursesController.list);
