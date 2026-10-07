import { db } from '../../config/knex.js';
import type { ConversationRow, ConversationType, MessageType } from '../schema-types.js';
import { withTimestamps } from '../../utils/timestamps.js';

function individualKey(userIdA: number, userIdB: number): string {
  const [a, b] = [userIdA, userIdB].sort((x, y) => x - y);
  return `${a}_${b}`;
}

export const conversationsRepository = {
  findById(id: number) {
    return db<ConversationRow>('conversations').where({ id }).first();
  },

  findByIndividualKey(userIdA: number, userIdB: number) {
    return db<ConversationRow>('conversations').where({ individual_key: individualKey(userIdA, userIdB) }).first();
  },

  async createIndividual(userIdA: number, userIdB: number): Promise<ConversationRow> {
    const existing = await this.findByIndividualKey(userIdA, userIdB);
    if (existing) return existing;

    try {
      const [id] = await db('conversations').insert(
        withTimestamps({
          type: 'individual' satisfies ConversationType,
          individual_key: individualKey(userIdA, userIdB),
          created_by: userIdA,
        })
      );
      await db('conversation_participants').insert([
        withTimestamps({ conversation_id: id, user_id: userIdA, role: 'member' }),
        withTimestamps({ conversation_id: id, user_id: userIdB, role: 'member' }),
      ]);
      return (await this.findById(id))!;
    } catch (err: any) {
      // Lost a race to another request creating the same 1:1 thread —
      // the unique(individual_key) constraint caught it, just fetch it.
      if (err?.code === 'ER_DUP_ENTRY') {
        const row = await this.findByIndividualKey(userIdA, userIdB);
        if (row) return row;
      }
      throw err;
    }
  },

  async createGroup(params: {
    createdBy: number;
    type: 'group' | 'course_group';
    name: string;
    description?: string | null;
    courseId?: number | null;
    isPublic?: boolean;
    participantUserIds: number[];
  }): Promise<ConversationRow> {
    const id = await db.transaction(async (trx) => {
      const [newId] = await trx('conversations').insert(
        withTimestamps({
          type: params.type,
          name: params.name,
          description: params.description ?? null,
          course_id: params.courseId ?? null,
          is_public: params.isPublic ?? false,
          created_by: params.createdBy,
        })
      );

      const memberIds = new Set(params.participantUserIds);
      memberIds.delete(params.createdBy);

      await trx('conversation_participants').insert([
        withTimestamps({ conversation_id: newId, user_id: params.createdBy, role: 'owner' }),
        ...[...memberIds].map((userId) =>
          withTimestamps({ conversation_id: newId, user_id: userId, role: 'member' as const })
        ),
      ]);

      return newId;
    });

    return (await this.findById(id))!;
  },

  async listForUser(
    userId: number,
    opts: { limit: number; cursor?: { lastMessageAt: Date; id: number } | null; search?: string }
  ) {
    const query = db<ConversationRow>('conversations as c')
      .join('conversation_participants as cp', 'cp.conversation_id', 'c.id')
      .where('cp.user_id', userId)
      .whereNull('cp.left_at')
      .select('c.*');

    if (opts.search) {
      query.andWhere('c.name', 'like', `%${opts.search}%`);
    }

    if (opts.cursor) {
      query.andWhere((qb) => {
        qb.where('c.last_message_at', '<', opts.cursor!.lastMessageAt).orWhere((qb2) => {
          qb2.where('c.last_message_at', opts.cursor!.lastMessageAt).andWhere('c.id', '<', opts.cursor!.id);
        });
      });
    }

    query.orderBy('c.last_message_at', 'desc').orderBy('c.id', 'desc').limit(opts.limit + 1);

    return query;
  },

  async touchLastMessage(
    conversationId: number,
    data: { at: Date; preview: string; senderId: number | null; type: MessageType }
  ) {
    await db('conversations').where({ id: conversationId }).update({
      last_message_at: data.at,
      last_message_preview: data.preview,
      last_message_sender_id: data.senderId,
      last_message_type: data.type,
      updated_at: new Date(),
    });
  },

  async update(
    conversationId: number,
    changes: {
      name?: string;
      description?: string;
      avatar_path?: string;
      only_admins_can_send?: boolean;
      only_admins_can_add_members?: boolean;
      only_admins_can_edit_info?: boolean;
    }
  ) {
    const { only_admins_can_send, only_admins_can_add_members, only_admins_can_edit_info, ...rest } = changes;
    await db('conversations')
      .where({ id: conversationId })
      .update({
        ...rest,
        ...(only_admins_can_send !== undefined ? { only_admins_can_send } : {}),
        ...(only_admins_can_add_members !== undefined ? { only_admins_can_add_members } : {}),
        ...(only_admins_can_edit_info !== undefined ? { only_admins_can_edit_info } : {}),
        updated_at: new Date(),
      });
    return this.findById(conversationId);
  },

  async listDirectory(opts: { courseId?: number; cursor?: number | null; limit: number }) {
    const query = db<ConversationRow>('conversations')
      .where('is_public', true)
      .whereIn('type', ['group', 'course_group']);

    if (opts.courseId) query.andWhere('course_id', opts.courseId);
    if (opts.cursor) query.andWhere('id', '<', opts.cursor);

    return query.orderBy('id', 'desc').limit(opts.limit + 1);
  },
};
