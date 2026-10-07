import { randomBytes } from 'crypto';
import { conversationsRepository } from '../db/repositories/conversations.repository.js';
import { joinLinksRepository } from '../db/repositories/joinLinks.repository.js';
import { participantsRepository } from '../db/repositories/participants.repository.js';
import { badRequest, notFound } from '../middleware/errorHandler.js';
import { conversationService, toDto, type ConversationDto } from './conversationService.js';

export interface JoinLinkDto {
  token: string;
  conversationId: number;
  expiresAt: Date | null;
  maxUses: number | null;
  useCount: number;
  createdAt: Date;
}

function toJoinLinkDto(row: {
  token: string;
  conversation_id: number;
  expires_at: Date | null;
  max_uses: number | null;
  use_count: number;
  created_at: Date;
}): JoinLinkDto {
  return {
    token: row.token,
    conversationId: row.conversation_id,
    expiresAt: row.expires_at,
    maxUses: row.max_uses,
    useCount: row.use_count,
    createdAt: row.created_at,
  };
}

export const joinLinkService = {
  async create(conversationId: number, userId: number, opts: { expiresAt?: Date; maxUses?: number }): Promise<JoinLinkDto> {
    const conversation = await conversationsRepository.findById(conversationId);
    if (!conversation) throw notFound('Conversation not found');
    if (conversation.type === 'individual') throw badRequest('Individual conversations cannot have join links');
    await conversationService.assertManager(conversationId, userId);

    const token = randomBytes(24).toString('base64url');
    const row = await joinLinksRepository.create({
      conversationId,
      token,
      createdBy: userId,
      expiresAt: opts.expiresAt ?? null,
      maxUses: opts.maxUses ?? null,
    });
    return toJoinLinkDto(row!);
  },

  async list(conversationId: number, userId: number): Promise<JoinLinkDto[]> {
    await conversationService.assertManager(conversationId, userId);
    const rows = await joinLinksRepository.listForConversation(conversationId);
    return rows.map(toJoinLinkDto);
  },

  async revoke(token: string, userId: number): Promise<void> {
    const revoked = await joinLinksRepository.revoke(token, userId);
    if (!revoked) throw notFound('Join link not found, or you are not the one who created it');
  },

  async preview(token: string): Promise<{ conversation: ConversationDto; usable: boolean }> {
    const link = await joinLinksRepository.findByToken(token);
    if (!link) throw notFound('Invalid join link');
    const conversation = await conversationsRepository.findById(link.conversation_id);
    if (!conversation) throw notFound('This group no longer exists');

    return { conversation: toDto(conversation, null), usable: joinLinksRepository.isUsable(link) };
  },

  async consume(token: string, userId: number): Promise<ConversationDto> {
    const link = await joinLinksRepository.findByToken(token);
    if (!link) throw notFound('Invalid join link');
    if (!joinLinksRepository.isUsable(link)) throw badRequest('This join link has expired or reached its use limit');

    const conversation = await conversationsRepository.findById(link.conversation_id);
    if (!conversation) throw notFound('This group no longer exists');

    await participantsRepository.addOrReactivate(link.conversation_id, userId, { invitedBy: link.created_by });
    await joinLinksRepository.incrementUse(token);

    return toDto(conversation, null);
  },
};
