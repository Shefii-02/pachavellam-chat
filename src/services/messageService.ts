import { attachmentsRepository } from '../db/repositories/attachments.repository.js';
import { conversationsRepository } from '../db/repositories/conversations.repository.js';
import { mentionsRepository } from '../db/repositories/mentions.repository.js';
import { messagesRepository } from '../db/repositories/messages.repository.js';
import { participantsRepository } from '../db/repositories/participants.repository.js';
import { reactionsRepository } from '../db/repositories/reactions.repository.js';
import type { MessageAttachmentRow, MessageReactionRow, MessageRow, MessageType } from '../db/schema-types.js';
import { badRequest, forbidden, notFound } from '../middleware/errorHandler.js';
import { extractMentionedUserIds } from '../utils/mentionMarkup.js';
import { decodeMessageCursor } from '../utils/pagination.js';
import { conversationService } from './conversationService.js';
import { presenceService } from './presenceService.js';
import { pushDispatchService } from './pushDispatchService.js';

export interface MessageAttachmentDto {
  id: number;
  type: string;
  url: string;
  originalFilename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  thumbnailUrl: string | null;
}

export interface MessageReactionDto {
  userId: number;
  emoji: string;
}

export interface ReplyPreviewDto {
  id: number;
  senderId: number | null;
  senderName: string | null;
  type: MessageRow['type'];
  preview: string;
  isDeleted: boolean;
}

export interface MessageDto {
  id: number;
  conversationId: number;
  sender: { id: number; name: string; image: string | null } | null;
  type: MessageRow['type'];
  body: string | null;
  replyToMessageId: number | null;
  replyTo: ReplyPreviewDto | null;
  forwardedFromMessageId: number | null;
  attachments: MessageAttachmentDto[];
  reactions: MessageReactionDto[];
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
}

type MessageRowWithSender = MessageRow & { sender_name?: string; sender_image?: string | null };

function toAttachmentDto(row: MessageAttachmentRow, publicMediaBaseUrl: string): MessageAttachmentDto {
  return {
    id: row.id,
    type: row.type,
    url: `${publicMediaBaseUrl}/${row.disk_path}`,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    durationSeconds: row.duration_seconds,
    width: row.width,
    height: row.height,
    thumbnailUrl: row.thumbnail_path ? `${publicMediaBaseUrl}/${row.thumbnail_path}` : null,
  };
}

function toReactionDto(row: MessageReactionRow): MessageReactionDto {
  return { userId: row.user_id, emoji: row.emoji };
}

function toReplyPreviewDto(row: MessageRowWithSender): ReplyPreviewDto {
  return {
    id: row.id,
    senderId: row.sender_id,
    senderName: row.sender_name ?? null,
    type: row.type,
    preview: row.deleted_at ? 'This message was deleted' : previewFor(row.type, row.body),
    isDeleted: !!row.deleted_at,
  };
}

function toDto(
  row: MessageRowWithSender,
  extras: { attachments?: MessageAttachmentDto[]; reactions?: MessageReactionDto[]; replyTo?: ReplyPreviewDto | null } = {}
): MessageDto {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    sender: row.sender_id
      ? { id: row.sender_id, name: row.sender_name ?? '', image: row.sender_image ?? null }
      : null,
    type: row.type,
    body: row.body,
    replyToMessageId: row.reply_to_message_id,
    replyTo: extras.replyTo ?? null,
    forwardedFromMessageId: row.forwarded_from_message_id,
    attachments: extras.attachments ?? [],
    reactions: extras.reactions ?? [],
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
  };
}

const MESSAGE_PREVIEW_MAX_LENGTH = 120;

function previewFor(type: MessageType, body: string | null): string {
  switch (type) {
    case 'image':
      return '📷 Photo';
    case 'video':
      return '🎥 Video';
    case 'document':
      return '📄 Document';
    case 'audio':
      return '🎵 Audio';
    case 'voice_note':
      return '🎤 Voice message';
    case 'system':
      return body ?? '';
    case 'text':
    default:
      return (body ?? '').slice(0, MESSAGE_PREVIEW_MAX_LENGTH);
  }
}

async function buildReplyPreview(replyToMessageId?: number | null): Promise<ReplyPreviewDto | null> {
  if (!replyToMessageId) return null;
  const row = await messagesRepository.findById(replyToMessageId);
  return row ? toReplyPreviewDto(row) : null;
}

/** Validates `@[userId:Name]` mentions in a body against who can actually
 * be mentioned (active participants) — never trust client-submitted ids. */
async function saveValidatedMentions(conversationId: number, messageId: number, body: string | null) {
  const candidateIds = extractMentionedUserIds(body);
  if (candidateIds.length === 0) return;
  const activeIds = new Set(await participantsRepository.activeUserIds(conversationId));
  const validIds = candidateIds.filter((id) => activeIds.has(id));
  if (validIds.length > 0) await mentionsRepository.setForMessage(messageId, validIds);
}

/**
 * Pushes to every active participant who is (a) not the sender, (b) not
 * currently connected via socket, and (c) not muted — unless they were
 * specifically @mentioned, which always bypasses a mute.
 * Fire-and-forget: never awaited by the send path, and pushDispatchService
 * itself swallows its own errors, so a push failure can't break sending.
 */
function notifyOfflineParticipants(params: {
  conversationId: number;
  senderId: number;
  senderName: string;
  messageId: number;
  preview: string;
  mentionedUserIds: number[];
}): void {
  void (async () => {
    const [conversation, activeIds, mutedIds] = await Promise.all([
      conversationsRepository.findById(params.conversationId),
      participantsRepository.activeUserIds(params.conversationId),
      participantsRepository.mutedUserIds(params.conversationId),
    ]);
    if (!conversation) return;

    const mentioned = new Set(params.mentionedUserIds);
    const muted = new Set(mutedIds);
    const candidates = activeIds.filter((id) => id !== params.senderId && (!muted.has(id) || mentioned.has(id)));
    if (candidates.length === 0) return;

    const { offline } = presenceService.partitionByPresence(candidates);
    if (offline.length === 0) return;

    const title = conversation.type === 'individual' ? params.senderName : conversation.name ?? 'New message';
    const body = conversation.type === 'individual' ? params.preview : `${params.senderName}: ${params.preview}`;

    await pushDispatchService.dispatch({
      recipientUserIds: offline,
      title,
      body,
      data: {
        conversation_id: String(params.conversationId),
        message_id: String(params.messageId),
        type: 'chat_message',
      },
    });
  })();
}

export const messageService = {
  async sendText(conversationId: number, senderId: number, body: string, replyToMessageId?: number | null) {
    const trimmed = body?.trim();
    if (!trimmed) throw badRequest('Message body cannot be empty');

    await conversationService.assertCanSend(conversationId, senderId);

    const row = await messagesRepository.createText({
      conversationId,
      senderId,
      body: trimmed,
      replyToMessageId,
    });
    if (!row) throw notFound('Failed to load created message');

    await Promise.all([
      conversationsRepository.touchLastMessage(conversationId, {
        at: row.created_at,
        preview: previewFor('text', trimmed),
        senderId,
        type: 'text',
      }),
      // You've implicitly "read" the message you just sent — without this,
      // the sender would see their own conversation as unread.
      participantsRepository.updateLastRead(conversationId, senderId, row.id),
      saveValidatedMentions(conversationId, row.id, trimmed),
    ]);

    notifyOfflineParticipants({
      conversationId,
      senderId,
      senderName: row.sender_name ?? 'Someone',
      messageId: row.id,
      preview: previewFor('text', trimmed),
      mentionedUserIds: extractMentionedUserIds(trimmed),
    });

    const replyTo = await buildReplyPreview(replyToMessageId);
    return toDto(row, { replyTo });
  },

  async sendMedia(params: {
    conversationId: number;
    senderId: number;
    type: MessageType;
    caption?: string | null;
    replyToMessageId?: number | null;
    attachment: {
      diskPath: string;
      originalFilename?: string | null;
      mimeType?: string | null;
      sizeBytes?: number | null;
      durationSeconds?: number | null;
      width?: number | null;
      height?: number | null;
    };
    publicMediaBaseUrl: string;
  }) {
    await conversationService.assertCanSend(params.conversationId, params.senderId);

    const row = await messagesRepository.createMedia({
      conversationId: params.conversationId,
      senderId: params.senderId,
      type: params.type,
      caption: params.caption,
      replyToMessageId: params.replyToMessageId,
    });
    if (!row) throw notFound('Failed to load created message');

    const attachmentRow = await attachmentsRepository.create({ messageId: row.id, type: params.type, ...params.attachment });
    if (!attachmentRow) throw notFound('Failed to load created attachment');

    await Promise.all([
      conversationsRepository.touchLastMessage(params.conversationId, {
        at: row.created_at,
        preview: previewFor(params.type, params.caption ?? null),
        senderId: params.senderId,
        type: params.type,
      }),
      participantsRepository.updateLastRead(params.conversationId, params.senderId, row.id),
      saveValidatedMentions(params.conversationId, row.id, params.caption ?? null),
    ]);

    notifyOfflineParticipants({
      conversationId: params.conversationId,
      senderId: params.senderId,
      senderName: row.sender_name ?? 'Someone',
      messageId: row.id,
      preview: previewFor(params.type, params.caption ?? null),
      mentionedUserIds: extractMentionedUserIds(params.caption ?? null),
    });

    const replyTo = await buildReplyPreview(params.replyToMessageId);
    return toDto(row, { attachments: [toAttachmentDto(attachmentRow, params.publicMediaBaseUrl)], replyTo });
  },

  async listForConversation(
    conversationId: number,
    userId: number,
    query: { cursor?: string; limit: number },
    publicMediaBaseUrl: string
  ) {
    await conversationService.assertActiveParticipant(conversationId, userId);

    const beforeId = query.cursor ? decodeMessageCursor(query.cursor) : null;
    const rows = await messagesRepository.listForConversation(conversationId, { limit: query.limit, beforeId });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const oldestFirst = [...page].reverse();
    const messageIds = oldestFirst.map((m) => m.id);

    const [attachmentRows, reactionRows, replyToRows] = await Promise.all([
      attachmentsRepository.forMessages(messageIds),
      reactionsRepository.forMessages(messageIds),
      messagesRepository.findByIds(
        [...new Set(oldestFirst.map((m) => m.reply_to_message_id).filter((id): id is number => id != null))]
      ),
    ]);

    const attachmentsByMessage = groupBy(attachmentRows, (a) => a.message_id, (a) => toAttachmentDto(a, publicMediaBaseUrl));
    const reactionsByMessage = groupBy(reactionRows, (r) => r.message_id, toReactionDto);
    const replyPreviewById = new Map(replyToRows.map((r) => [r.id, toReplyPreviewDto(r)]));

    return {
      items: oldestFirst.map((row) =>
        toDto(row, {
          attachments: attachmentsByMessage.get(row.id) ?? [],
          reactions: reactionsByMessage.get(row.id) ?? [],
          replyTo: row.reply_to_message_id ? replyPreviewById.get(row.reply_to_message_id) ?? null : null,
        })
      ),
      nextCursor: hasMore ? String(page.at(-1)!.id) : null,
    };
  },

  async setReaction(messageId: number, userId: number, emoji: string) {
    const message = await messagesRepository.findById(messageId);
    if (!message) throw notFound('Message not found');
    await conversationService.assertActiveParticipant(message.conversation_id, userId);

    await reactionsRepository.set(messageId, userId, emoji);
    const reactions = await reactionsRepository.forMessage(messageId);
    return { conversationId: message.conversation_id, reactions: reactions.map(toReactionDto) };
  },

  async removeReaction(messageId: number, userId: number) {
    const message = await messagesRepository.findById(messageId);
    if (!message) throw notFound('Message not found');
    await conversationService.assertActiveParticipant(message.conversation_id, userId);

    await reactionsRepository.remove(messageId, userId);
    const reactions = await reactionsRepository.forMessage(messageId);
    return { conversationId: message.conversation_id, reactions: reactions.map(toReactionDto) };
  },

  async forward(messageId: number, userId: number, targetConversationIds: number[], publicMediaBaseUrl: string) {
    const source = await messagesRepository.findById(messageId);
    if (!source) throw notFound('Message not found');
    await conversationService.assertActiveParticipant(source.conversation_id, userId);
    if (source.deleted_at) throw badRequest('Cannot forward a deleted message');

    const sourceAttachments = await attachmentsRepository.forMessage(source.id);
    const forwarded: MessageDto[] = [];

    for (const targetId of targetConversationIds) {
      await conversationService.assertCanSend(targetId, userId);

      const row = await messagesRepository.createForward({
        conversationId: targetId,
        senderId: userId,
        type: source.type,
        body: source.body,
        sourceMessageId: source.id,
        sourceConversationId: source.conversation_id,
      });
      if (!row) continue;

      const newAttachments: MessageAttachmentDto[] = [];
      for (const attachment of sourceAttachments) {
        const copy = await attachmentsRepository.create({
          messageId: row.id,
          type: attachment.type,
          diskPath: attachment.disk_path,
          originalFilename: attachment.original_filename,
          mimeType: attachment.mime_type,
          sizeBytes: attachment.size_bytes,
          durationSeconds: attachment.duration_seconds,
          width: attachment.width,
          height: attachment.height,
        });
        if (copy) newAttachments.push(toAttachmentDto(copy, publicMediaBaseUrl));
      }

      await Promise.all([
        conversationsRepository.touchLastMessage(targetId, {
          at: row.created_at,
          preview: previewFor(row.type, row.body),
          senderId: userId,
          type: row.type,
        }),
        participantsRepository.updateLastRead(targetId, userId, row.id),
      ]);

      forwarded.push(toDto(row, { attachments: newAttachments }));
    }

    return forwarded;
  },

  async search(userId: number, query: string, opts: { conversationId?: number; limit?: number }) {
    const trimmed = query.trim();
    if (!trimmed) return { items: [] };

    const myConversationIds = await participantsRepository.activeConversationIdsForUser(userId);

    let scope: number[];
    if (opts.conversationId) {
      if (!myConversationIds.includes(opts.conversationId)) {
        throw forbidden('You are not a participant of this conversation');
      }
      scope = [opts.conversationId];
    } else {
      scope = myConversationIds;
    }
    if (scope.length === 0) return { items: [] };

    const rows = await messagesRepository.search({ conversationIds: scope, query: trimmed, limit: opts.limit ?? 50 });
    return { items: rows.map((row) => toDto(row)) };
  },

  dtoOf: toDto,
};

function groupBy<T, V>(rows: T[], keyOf: (row: T) => number, valueOf: (row: T) => V): Map<number, V[]> {
  const map = new Map<number, V[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const list = map.get(key) ?? [];
    list.push(valueOf(row));
    map.set(key, list);
  }
  return map;
}
