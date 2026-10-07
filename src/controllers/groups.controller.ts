import type { NextFunction, Request, Response } from 'express';
import { conversationService } from '../services/conversationService.js';
import { groupService } from '../services/groupService.js';
import { badRequest } from '../middleware/errorHandler.js';
import { broadcastConversationNew, broadcastMemberUpdated } from '../sockets/index.js';
import {
  addMembersSchema,
  directoryQuerySchema,
  updateConversationSchema,
  updateMemberRoleSchema,
} from '../utils/validation.js';
import { clampLimit } from '../utils/pagination.js';
import { participantsRepository } from '../db/repositories/participants.repository.js';

export const groupsController = {
  async updateInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const body = updateConversationSchema.parse(req.body);
      const conversation = await conversationService.updateInfo(Number(req.params.id), req.userId!, {
        name: body.name,
        description: body.description,
        avatarPath: body.avatar_path,
        onlyAdminsCanSend: body.only_admins_can_send,
        onlyAdminsCanAddMembers: body.only_admins_can_add_members,
        onlyAdminsCanEditInfo: body.only_admins_can_edit_info,
      });
      res.json({ conversation });
    } catch (err) {
      next(err);
    }
  },

  async leave(req: Request, res: Response, next: NextFunction) {
    try {
      await conversationService.leave(Number(req.params.id), req.userId!);
      res.json({ message: 'Left the conversation' });
    } catch (err) {
      next(err);
    }
  },

  async listMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const members = await groupService.listMembers(Number(req.params.id), req.userId!);
      res.json({ items: members });
    } catch (err) {
      next(err);
    }
  },

  async addMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const conversationId = Number(req.params.id);
      const body = addMembersSchema.parse(req.body);
      const members = await groupService.addMembers(conversationId, req.userId!, body.user_ids);

      const conversation = await conversationService.getForUser(conversationId, req.userId!);
      broadcastConversationNew(conversation, body.user_ids);
      broadcastMemberUpdated(conversationId, members);

      res.status(201).json({ items: members });
    } catch (err) {
      next(err);
    }
  },

  async updateMember(req: Request, res: Response, next: NextFunction) {
    try {
      const conversationId = Number(req.params.id);
      const targetUserId = Number(req.params.userId);
      const body = updateMemberRoleSchema.parse(req.body);

      if (body.action === 'remove') {
        await groupService.removeMember(conversationId, req.userId!, targetUserId);
      } else if (body.role) {
        await groupService.updateMemberRole(conversationId, req.userId!, targetUserId, body.role);
      } else {
        throw badRequest('Provide either "role" or "action":"remove"');
      }

      const members = await participantsRepository.listActiveForConversation(conversationId);
      broadcastMemberUpdated(
        conversationId,
        members.map((m) => ({ userId: m.user_id, name: m.user_name, image: m.user_image, role: m.role, joinedAt: m.joined_at }))
      );

      res.json({ message: 'Updated' });
    } catch (err) {
      next(err);
    }
  },

  async directory(req: Request, res: Response, next: NextFunction) {
    try {
      const query = directoryQuerySchema.parse(req.query);
      const result = await groupService.joinDirectory(req.userId!, {
        courseId: query.course_id,
        cursor: query.cursor,
        limit: clampLimit(query.limit),
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async selfJoin(req: Request, res: Response, next: NextFunction) {
    try {
      const conversation = await groupService.selfJoin(Number(req.params.id), req.userId!);
      res.json({ conversation });
    } catch (err) {
      next(err);
    }
  },
};
