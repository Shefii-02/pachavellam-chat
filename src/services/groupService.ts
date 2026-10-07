import { conversationsRepository } from '../db/repositories/conversations.repository.js';
import { participantsRepository } from '../db/repositories/participants.repository.js';
import type { ConversationParticipantRow, ParticipantRole } from '../db/schema-types.js';
import { badRequest, forbidden, notFound } from '../middleware/errorHandler.js';
import { toDto, conversationService, type ConversationDto } from './conversationService.js';

export interface ParticipantDto {
  userId: number;
  name: string;
  image: string | null;
  role: ParticipantRole;
  joinedAt: Date;
}

function toParticipantDto(row: ConversationParticipantRow & { user_name?: string; user_image?: string | null }): ParticipantDto {
  return {
    userId: row.user_id,
    name: row.user_name ?? '',
    image: row.user_image ?? null,
    role: row.role,
    joinedAt: row.joined_at,
  };
}

async function assertIsGroup(conversationId: number) {
  const conversation = await conversationsRepository.findById(conversationId);
  if (!conversation) throw notFound('Conversation not found');
  if (conversation.type === 'individual') throw badRequest('Individual conversations have no members to manage');
  return conversation;
}

export const groupService = {
  async listMembers(conversationId: number, userId: number): Promise<ParticipantDto[]> {
    await assertIsGroup(conversationId);
    await conversationService.assertActiveParticipant(conversationId, userId);
    const rows = await participantsRepository.listActiveForConversation(conversationId);
    return rows.map(toParticipantDto);
  },

  async addMembers(conversationId: number, actingUserId: number, userIds: number[]): Promise<ParticipantDto[]> {
    const conversation = await assertIsGroup(conversationId);

    if (conversation.only_admins_can_add_members) {
      await conversationService.assertManager(conversationId, actingUserId);
    } else {
      await conversationService.assertActiveParticipant(conversationId, actingUserId);
    }

    for (const userId of userIds) {
      await participantsRepository.addOrReactivate(conversationId, userId, { invitedBy: actingUserId });
    }

    const rows = await participantsRepository.listActiveForConversation(conversationId);
    return rows.map(toParticipantDto);
  },

  async updateMemberRole(conversationId: number, actingUserId: number, targetUserId: number, role: 'admin' | 'member') {
    await assertIsGroup(conversationId);
    await conversationService.assertManager(conversationId, actingUserId);

    const target = await participantsRepository.get(conversationId, targetUserId);
    if (!target || target.left_at) throw notFound('That person is not a member of this group');
    if (target.role === 'owner') throw forbidden("The group owner's role can't be changed");

    await participantsRepository.updateRole(conversationId, targetUserId, role);
  },

  async removeMember(conversationId: number, actingUserId: number, targetUserId: number) {
    await assertIsGroup(conversationId);
    await conversationService.assertManager(conversationId, actingUserId);

    const target = await participantsRepository.get(conversationId, targetUserId);
    if (!target || target.left_at) throw notFound('That person is not a member of this group');
    if (target.role === 'owner') throw forbidden('The group owner cannot be removed');

    await participantsRepository.removeMember(conversationId, targetUserId);
  },

  async joinDirectory(
    userId: number,
    opts: { courseId?: number; cursor?: string; limit: number }
  ): Promise<{ items: ConversationDto[]; nextCursor: string | null }> {
    const cursor = opts.cursor ? Number(opts.cursor) : null;
    const rows = await conversationsRepository.listDirectory({ courseId: opts.courseId, cursor, limit: opts.limit });

    const hasMore = rows.length > opts.limit;
    const page = hasMore ? rows.slice(0, opts.limit) : rows;

    return {
      items: page.map((row) => toDto(row, null)),
      nextCursor: hasMore ? String(page.at(-1)!.id) : null,
    };
  },

  async selfJoin(conversationId: number, userId: number): Promise<ConversationDto> {
    const conversation = await conversationsRepository.findById(conversationId);
    if (!conversation) throw notFound('Conversation not found');
    if (!conversation.is_public) throw forbidden('This group is not open for self-joining');

    await participantsRepository.addOrReactivate(conversationId, userId);
    return toDto(conversation, null);
  },
};
