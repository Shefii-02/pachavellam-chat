import { db } from '../../config/knex.js';
import type { MessageReactionRow } from '../schema-types.js';

export const reactionsRepository = {
  /** One reaction per user per message — changing it is an upsert. */
  async set(messageId: number, userId: number, emoji: string) {
    await db('message_reactions')
      .insert({ message_id: messageId, user_id: userId, emoji, created_at: new Date() })
      .onConflict(['message_id', 'user_id'])
      .merge(['emoji']);
  },

  async remove(messageId: number, userId: number) {
    await db('message_reactions').where({ message_id: messageId, user_id: userId }).delete();
  },

  forMessage(messageId: number) {
    return db<MessageReactionRow>('message_reactions').where({ message_id: messageId });
  },

  forMessages(messageIds: number[]) {
    if (messageIds.length === 0) return Promise.resolve([] as MessageReactionRow[]);
    return db<MessageReactionRow>('message_reactions').whereIn('message_id', messageIds);
  },
};
