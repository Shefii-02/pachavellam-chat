import { db } from '../../config/knex.js';
import type { MessageMentionRow } from '../schema-types.js';

export const mentionsRepository = {
  async setForMessage(messageId: number, mentionedUserIds: number[]) {
    await db('message_mentions').where({ message_id: messageId }).delete();
    if (mentionedUserIds.length === 0) return;
    await db('message_mentions').insert(
      [...new Set(mentionedUserIds)].map((userId) => ({
        message_id: messageId,
        mentioned_user_id: userId,
        created_at: new Date(),
      }))
    );
  },

  forMessages(messageIds: number[]) {
    if (messageIds.length === 0) return Promise.resolve([] as MessageMentionRow[]);
    return db<MessageMentionRow>('message_mentions').whereIn('message_id', messageIds);
  },
};
