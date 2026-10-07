import { db } from '../../config/knex.js';
import type { MessageAttachmentRow } from '../schema-types.js';

export const attachmentsRepository = {
  async create(params: {
    messageId: number;
    type: string;
    diskPath: string;
    originalFilename?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
    durationSeconds?: number | null;
    width?: number | null;
    height?: number | null;
  }) {
    const [id] = await db('message_attachments').insert({
      message_id: params.messageId,
      type: params.type,
      disk_path: params.diskPath,
      original_filename: params.originalFilename ?? null,
      mime_type: params.mimeType ?? null,
      size_bytes: params.sizeBytes ?? null,
      duration_seconds: params.durationSeconds ?? null,
      width: params.width ?? null,
      height: params.height ?? null,
      created_at: new Date(),
    });
    return db<MessageAttachmentRow>('message_attachments').where({ id }).first();
  },

  forMessage(messageId: number) {
    return db<MessageAttachmentRow>('message_attachments').where({ message_id: messageId });
  },

  forMessages(messageIds: number[]) {
    if (messageIds.length === 0) return Promise.resolve([] as MessageAttachmentRow[]);
    return db<MessageAttachmentRow>('message_attachments').whereIn('message_id', messageIds);
  },
};
