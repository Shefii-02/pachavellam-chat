import { db } from '../../config/knex.js';
import type { MessageRow, MessageType } from '../schema-types.js';

const SENDER_JOIN_COLUMNS = [
  'messages.*',
  'users.name as sender_name',
  'users.image as sender_image',
] as const;

function withSender() {
  return db<MessageRow>('messages').leftJoin('users', 'users.id', 'messages.sender_id').select(SENDER_JOIN_COLUMNS);
}

export const messagesRepository = {
  findById(id: number) {
    return withSender().where('messages.id', id).first();
  },

  async createText(params: {
    conversationId: number;
    senderId: number;
    body: string;
    replyToMessageId?: number | null;
  }) {
    const [id] = await db('messages').insert({
      conversation_id: params.conversationId,
      sender_id: params.senderId,
      type: 'text' satisfies MessageType,
      body: params.body,
      reply_to_message_id: params.replyToMessageId ?? null,
    });
    return this.findById(id);
  },

  async createMedia(params: {
    conversationId: number;
    senderId: number;
    type: MessageType;
    caption?: string | null;
    replyToMessageId?: number | null;
  }) {
    const [id] = await db('messages').insert({
      conversation_id: params.conversationId,
      sender_id: params.senderId,
      type: params.type,
      body: params.caption ?? null,
      reply_to_message_id: params.replyToMessageId ?? null,
    });
    return this.findById(id);
  },

  /** Returns up to `limit + 1` rows in id-desc order (newest first); caller reverses for display. */
  listForConversation(conversationId: number, opts: { limit: number; beforeId?: number | null }) {
    const query = withSender().where('messages.conversation_id', conversationId);

    if (opts.beforeId) {
      query.andWhere('messages.id', '<', opts.beforeId);
    }

    return query.orderBy('messages.id', 'desc').limit(opts.limit + 1);
  },

  async softDelete(id: number) {
    await db('messages').where({ id }).update({ deleted_at: new Date(), body: null });
    return this.findById(id);
  },

  findByIds(ids: number[]) {
    if (ids.length === 0) return Promise.resolve([] as (MessageRow & { sender_name?: string; sender_image?: string | null })[]);
    return withSender().whereIn('messages.id', ids);
  },

  async createForward(params: {
    conversationId: number;
    senderId: number;
    type: MessageType;
    body: string | null;
    sourceMessageId: number;
    sourceConversationId: number;
  }) {
    const [id] = await db('messages').insert({
      conversation_id: params.conversationId,
      sender_id: params.senderId,
      type: params.type,
      body: params.body,
      forwarded_from_message_id: params.sourceMessageId,
      forwarded_from_conversation_id: params.sourceConversationId,
    });
    return this.findById(id);
  },

  /** Simple LIKE search, scoped by the caller to the conversations a user can actually see. */
  search(opts: { conversationIds: number[]; query: string; limit: number }) {
    return withSender()
      .whereIn('messages.conversation_id', opts.conversationIds)
      .whereNull('messages.deleted_at')
      .andWhere('messages.body', 'like', `%${opts.query}%`)
      .orderBy('messages.id', 'desc')
      .limit(opts.limit);
  },
};
