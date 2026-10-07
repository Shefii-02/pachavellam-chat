import { db } from '../config/knex.js';
import { conversationsRepository } from '../db/repositories/conversations.repository.js';
import { participantsRepository } from '../db/repositories/participants.repository.js';
import { usersRepository } from '../db/repositories/users.repository.js';
import type { ConversationRow } from '../db/schema-types.js';
import { badRequest, forbidden, notFound } from '../middleware/errorHandler.js';
import { decodeConversationCursor, encodeConversationCursor } from '../utils/pagination.js';

const MANAGER_ROLES = new Set(['owner', 'admin']);

export interface ConversationDto {
  id: number;
  type: ConversationRow['type'];
  name: string | null;
  description: string | null;
  avatarPath: string | null;
  courseId: number | null;
  isPublic: boolean;
  permissions: {
    onlyAdminsCanSend: boolean;
    onlyAdminsCanAddMembers: boolean;
    onlyAdminsCanEditInfo: boolean;
  };
  lastMessage: {
    at: Date | null;
    preview: string | null;
    senderId: number | null;
    type: ConversationRow['last_message_type'];
  };
  hasUnread: boolean;
  createdAt: Date;
}

async function attachIndividualDisplayInfo(rows: ConversationRow[], userId: number): Promise<Map<number, { name: string; image: string | null }>> {
  const individualIds = rows.filter((r) => r.type === 'individual').map((r) => r.id);
  const map = new Map<number, { name: string; image: string | null }>();
  if (individualIds.length === 0) return map;

  const others = await db('conversation_participants')
    .join('users', 'users.id', 'conversation_participants.user_id')
    .whereIn('conversation_participants.conversation_id', individualIds)
    .andWhere('conversation_participants.user_id', '!=', userId)
    .select('conversation_participants.conversation_id', 'users.name', 'users.image');

  for (const row of others) {
    map.set(row.conversation_id, { name: row.name, image: row.image });
  }
  return map;
}

export function toDto(row: ConversationRow, lastReadAt: Date | null, displayInfo?: { name: string; image: string | null }): ConversationDto {
  // Unread is approximated by comparing timestamps rather than message ids,
  // since the conversation row only denormalizes last_message_at (not an
  // id) — good enough to drive a "has unread" badge without an extra join
  // per conversation in a list of potentially hundreds.
  const hasUnread = !!row.last_message_at && (!lastReadAt || row.last_message_at > lastReadAt);

  return {
    id: row.id,
    type: row.type,
    name: row.type === 'individual' ? displayInfo?.name ?? null : row.name,
    description: row.description,
    avatarPath: row.type === 'individual' ? displayInfo?.image ?? null : row.avatar_path,
    courseId: row.course_id,
    isPublic: !!row.is_public,
    permissions: {
      onlyAdminsCanSend: !!row.only_admins_can_send,
      onlyAdminsCanAddMembers: !!row.only_admins_can_add_members,
      onlyAdminsCanEditInfo: !!row.only_admins_can_edit_info,
    },
    lastMessage: {
      at: row.last_message_at,
      preview: row.last_message_preview,
      senderId: row.last_message_sender_id,
      type: row.last_message_type,
    },
    hasUnread,
    createdAt: row.created_at,
  };
}

export const conversationService = {
  async listForUser(userId: number, query: { cursor?: string; limit: number; search?: string }) {
    const cursor = query.cursor ? decodeConversationCursor(query.cursor) : null;
    const rows = await conversationsRepository.listForUser(userId, { limit: query.limit, cursor, search: query.search });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    const [displayInfo, participantRows] = await Promise.all([
      attachIndividualDisplayInfo(page, userId),
      db('conversation_participants')
        .whereIn('conversation_id', page.map((r) => r.id))
        .andWhere('user_id', userId)
        .select('conversation_id', 'last_read_at'),
    ]);
    const lastReadByConversation = new Map(participantRows.map((p) => [p.conversation_id, p.last_read_at]));

    const items = page.map((row) => toDto(row, lastReadByConversation.get(row.id) ?? null, displayInfo.get(row.id)));
    const last = page.at(-1);
    const nextCursor = hasMore && last ? encodeConversationCursor(last.last_message_at, last.id) : null;

    return { items, nextCursor };
  },

  async getForUser(conversationId: number, userId: number) {
    const row = await conversationsRepository.findById(conversationId);
    if (!row) throw notFound('Conversation not found');

    const participant = await participantsRepository.get(conversationId, userId);
    if (!participant || participant.left_at) throw forbidden('You are not a participant of this conversation');

    const displayInfo = row.type === 'individual' ? await attachIndividualDisplayInfo([row], userId) : undefined;
    return toDto(row, participant.last_read_at, displayInfo?.get(row.id));
  },

  async createIndividual(userId: number, otherUserId: number) {
    if (userId === otherUserId) throw badRequest('Cannot start a conversation with yourself');
    const row = await conversationsRepository.createIndividual(userId, otherUserId);
    const displayInfo = await attachIndividualDisplayInfo([row], userId);
    return toDto(row, null, displayInfo.get(row.id));
  },

  async createGroup(
    userId: number,
    dto: {
      type: 'group' | 'course_group';
      name: string;
      description?: string;
      courseId?: number;
      isPublic?: boolean;
      participantUserIds: number[];
    }
  ) {
    if (!dto.name?.trim()) throw badRequest('Group name is required');
    if (dto.type === 'course_group') {
      if (!dto.courseId) throw badRequest('course_id is required for a course group');
      if (!(await usersRepository.isStaff(userId))) {
        throw forbidden('Only teachers or staff can create a course group');
      }
    }

    const row = await conversationsRepository.createGroup({
      createdBy: userId,
      type: dto.type,
      name: dto.name.trim(),
      description: dto.description ?? null,
      courseId: dto.courseId ?? null,
      isPublic: dto.isPublic ?? false,
      participantUserIds: dto.participantUserIds ?? [],
    });
    return toDto(row, null);
  },

  async markRead(conversationId: number, userId: number, lastReadMessageId: number) {
    const participant = await participantsRepository.get(conversationId, userId);
    if (!participant || participant.left_at) throw forbidden('You are not a participant of this conversation');
    await participantsRepository.updateLastRead(conversationId, userId, lastReadMessageId);
  },

  /** `minutes` null/omitted mutes indefinitely; 0 or omitted entirely via unmute clears it. */
  async setMute(conversationId: number, userId: number, minutes: number | null) {
    const participant = await participantsRepository.get(conversationId, userId);
    if (!participant || participant.left_at) throw forbidden('You are not a participant of this conversation');

    // `muted_until` is a MySQL TIMESTAMP column, capped at 2038-01-19 (the
    // 32-bit Unix epoch limit) — 2037-12-31 is the "indefinitely" sentinel,
    // safely inside that range.
    const until = minutes == null ? new Date('2037-12-31T23:59:59Z') : new Date(Date.now() + minutes * 60_000);
    await participantsRepository.setMuted(conversationId, userId, until);
  },

  async unmute(conversationId: number, userId: number) {
    const participant = await participantsRepository.get(conversationId, userId);
    if (!participant || participant.left_at) throw forbidden('You are not a participant of this conversation');
    await participantsRepository.setMuted(conversationId, userId, null);
  },

  async assertActiveParticipant(conversationId: number, userId: number): Promise<void> {
    const isActive = await participantsRepository.isActiveParticipant(conversationId, userId);
    if (!isActive) throw forbidden('You are not a participant of this conversation');
  },

  /** Owner/admin only — gates member management and permission changes. */
  async assertManager(conversationId: number, userId: number): Promise<void> {
    const participant = await participantsRepository.get(conversationId, userId);
    if (!participant || participant.left_at || !MANAGER_ROLES.has(participant.role)) {
      throw forbidden('Only the group owner or an admin can do this');
    }
  },

  /** Active participant AND allowed to send under the group's current
   * "only admins can send" setting — checked on every message send. */
  async assertCanSend(conversationId: number, userId: number): Promise<void> {
    const [conversation, participant] = await Promise.all([
      conversationsRepository.findById(conversationId),
      participantsRepository.get(conversationId, userId),
    ]);
    if (!conversation) throw notFound('Conversation not found');
    if (!participant || participant.left_at) throw forbidden('You are not a participant of this conversation');
    if (conversation.only_admins_can_send && !MANAGER_ROLES.has(participant.role)) {
      throw forbidden('Only admins can send messages in this group');
    }
  },

  async updateInfo(
    conversationId: number,
    userId: number,
    changes: {
      name?: string;
      description?: string;
      avatarPath?: string;
      onlyAdminsCanSend?: boolean;
      onlyAdminsCanAddMembers?: boolean;
      onlyAdminsCanEditInfo?: boolean;
    }
  ) {
    const conversation = await conversationsRepository.findById(conversationId);
    if (!conversation) throw notFound('Conversation not found');
    if (conversation.type === 'individual') throw badRequest('Individual conversations have no editable info');

    const changingPermissions =
      changes.onlyAdminsCanSend !== undefined ||
      changes.onlyAdminsCanAddMembers !== undefined ||
      changes.onlyAdminsCanEditInfo !== undefined;

    if (changingPermissions || conversation.only_admins_can_edit_info) {
      await this.assertManager(conversationId, userId);
    } else {
      await this.assertActiveParticipant(conversationId, userId);
    }

    const row = await conversationsRepository.update(conversationId, {
      ...(changes.name !== undefined ? { name: changes.name } : {}),
      ...(changes.description !== undefined ? { description: changes.description } : {}),
      ...(changes.avatarPath !== undefined ? { avatar_path: changes.avatarPath } : {}),
      ...(changes.onlyAdminsCanSend !== undefined ? { only_admins_can_send: changes.onlyAdminsCanSend } : {}),
      ...(changes.onlyAdminsCanAddMembers !== undefined ? { only_admins_can_add_members: changes.onlyAdminsCanAddMembers } : {}),
      ...(changes.onlyAdminsCanEditInfo !== undefined ? { only_admins_can_edit_info: changes.onlyAdminsCanEditInfo } : {}),
    });
    return toDto(row!, null);
  },

  async leave(conversationId: number, userId: number) {
    const conversation = await conversationsRepository.findById(conversationId);
    if (!conversation) throw notFound('Conversation not found');
    if (conversation.type === 'individual') throw badRequest('Cannot leave an individual conversation');

    const participant = await participantsRepository.get(conversationId, userId);
    if (!participant || participant.left_at) throw forbidden('You are not a participant of this conversation');
    if (participant.role === 'owner') {
      throw badRequest('The owner cannot leave — transfer ownership or delete the group instead');
    }

    await participantsRepository.removeMember(conversationId, userId);
  },
};
