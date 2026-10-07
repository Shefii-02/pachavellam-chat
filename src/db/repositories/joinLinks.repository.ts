import { db } from '../../config/knex.js';
import { withTimestamps } from '../../utils/timestamps.js';
import type { ConversationJoinLinkRow } from '../schema-types.js';

export const joinLinksRepository = {
  async create(params: { conversationId: number; token: string; createdBy: number; expiresAt?: Date | null; maxUses?: number | null }) {
    await db('conversation_join_links').insert(
      withTimestamps({
        conversation_id: params.conversationId,
        token: params.token,
        created_by: params.createdBy,
        expires_at: params.expiresAt ?? null,
        max_uses: params.maxUses ?? null,
        use_count: 0,
      })
    );
    return db<ConversationJoinLinkRow>('conversation_join_links').where({ token: params.token }).first();
  },

  findByToken(token: string) {
    return db<ConversationJoinLinkRow>('conversation_join_links').where({ token }).first();
  },

  listForConversation(conversationId: number) {
    return db<ConversationJoinLinkRow>('conversation_join_links')
      .where({ conversation_id: conversationId })
      .whereNull('revoked_at')
      .orderBy('created_at', 'desc');
  },

  async incrementUse(token: string) {
    await db('conversation_join_links').where({ token }).increment('use_count', 1);
  },

  async revoke(token: string, byUserId: number) {
    const row = await this.findByToken(token);
    if (!row || row.created_by !== byUserId) return false;
    await db('conversation_join_links').where({ token }).update({ revoked_at: new Date() });
    return true;
  },

  isUsable(link: ConversationJoinLinkRow): boolean {
    if (link.revoked_at) return false;
    if (link.expires_at && link.expires_at.getTime() < Date.now()) return false;
    if (link.max_uses != null && link.use_count >= link.max_uses) return false;
    return true;
  },
};
