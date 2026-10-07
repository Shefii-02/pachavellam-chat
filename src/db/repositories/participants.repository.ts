import { db } from '../../config/knex.js';
import type { ConversationParticipantRow, ParticipantRole } from '../schema-types.js';
import { withTimestamps } from '../../utils/timestamps.js';

export const participantsRepository = {
  get(conversationId: number, userId: number) {
    return db<ConversationParticipantRow>('conversation_participants')
      .where({ conversation_id: conversationId, user_id: userId })
      .first();
  },

  async isActiveParticipant(conversationId: number, userId: number): Promise<boolean> {
    const row = await db('conversation_participants')
      .where({ conversation_id: conversationId, user_id: userId })
      .whereNull('left_at')
      .first();
    return !!row;
  },

  listActiveForConversation(conversationId: number) {
    return db<ConversationParticipantRow>('conversation_participants')
      .join('users', 'users.id', 'conversation_participants.user_id')
      .where('conversation_participants.conversation_id', conversationId)
      .whereNull('conversation_participants.left_at')
      .select(
        'conversation_participants.*',
        'users.name as user_name',
        'users.email as user_email',
        'users.image as user_image'
      );
  },

  async activeUserIds(conversationId: number): Promise<number[]> {
    const rows = await db('conversation_participants')
      .where({ conversation_id: conversationId })
      .whereNull('left_at')
      .pluck('user_id');
    return rows;
  },

  async searchActiveParticipants(params: { conversationId: number; query: string; excludeUserId: number; limit: number }) {
    return db('conversation_participants')
      .join('users', 'users.id', 'conversation_participants.user_id')
      .where('conversation_participants.conversation_id', params.conversationId)
      .whereNull('conversation_participants.left_at')
      .andWhere('users.id', '!=', params.excludeUserId)
      .andWhere('users.name', 'like', `%${params.query}%`)
      .select('users.id', 'users.name', 'users.image')
      .limit(params.limit);
  },

  async activeConversationIdsForUser(userId: number): Promise<number[]> {
    const rows = await db('conversation_participants')
      .where({ user_id: userId })
      .whereNull('left_at')
      .pluck('conversation_id');
    return rows;
  },

  updateLastRead(conversationId: number, userId: number, lastReadMessageId: number) {
    const now = new Date();
    return db('conversation_participants')
      .where({ conversation_id: conversationId, user_id: userId })
      .update({ last_read_message_id: lastReadMessageId, last_read_at: now, updated_at: now });
  },

  /** Adds a brand-new participant, or re-activates one who previously left
   * (re-joining inserts a *new* row only via the unique constraint — this
   * flips `left_at` back to null on the existing row instead). */
  async addOrReactivate(conversationId: number, userId: number, opts: { role?: ParticipantRole; invitedBy?: number | null } = {}) {
    const existing = await this.get(conversationId, userId);
    if (existing) {
      await db('conversation_participants')
        .where({ conversation_id: conversationId, user_id: userId })
        .update({ left_at: null, role: opts.role ?? existing.role, updated_at: new Date() });
      return;
    }
    await db('conversation_participants').insert(
      withTimestamps({
        conversation_id: conversationId,
        user_id: userId,
        role: opts.role ?? 'member',
        invited_by: opts.invitedBy ?? null,
      })
    );
  },

  updateRole(conversationId: number, userId: number, role: ParticipantRole) {
    return db('conversation_participants')
      .where({ conversation_id: conversationId, user_id: userId })
      .update({ role, updated_at: new Date() });
  },

  removeMember(conversationId: number, userId: number) {
    return db('conversation_participants')
      .where({ conversation_id: conversationId, user_id: userId })
      .update({ left_at: new Date(), updated_at: new Date() });
  },

  setMuted(conversationId: number, userId: number, until: Date | null) {
    return db('conversation_participants')
      .where({ conversation_id: conversationId, user_id: userId })
      .update({ muted_until: until, updated_at: new Date() });
  },

  /** Active participants with an unexpired mute right now. */
  async mutedUserIds(conversationId: number): Promise<number[]> {
    return db('conversation_participants')
      .where({ conversation_id: conversationId })
      .whereNull('left_at')
      .andWhere('muted_until', '>', new Date())
      .pluck('user_id');
  },
};
