import type { Server } from 'socket.io';
import { participantsRepository } from '../db/repositories/participants.repository.js';
import { authenticateSocket, type AuthenticatedSocket } from '../middleware/authenticateSocket.js';
import { presenceService } from '../services/presenceService.js';
import type { ConversationDto } from '../services/conversationService.js';
import type { ParticipantDto } from '../services/groupService.js';
import type { MessageDto } from '../services/messageService.js';
import { registerConversationHandlers } from './handlers/conversation.handlers.js';
import { registerMessageHandlers } from './handlers/message.handlers.js';
import { registerTypingHandlers } from './handlers/typing.handlers.js';

export function userRoom(userId: number): string {
  return `user:${userId}`;
}

export function conversationRoom(conversationId: number): string {
  return `conversation:${conversationId}`;
}

let ioRef: Server | null = null;

function getIo(): Server {
  if (!ioRef) throw new Error('Socket.IO server not initialized yet');
  return ioRef;
}

export function broadcastNewMessage(message: MessageDto): void {
  getIo().to(conversationRoom(message.conversationId)).emit('message:new', { message });
}

export function broadcastMessageUpdated(message: MessageDto): void {
  getIo().to(conversationRoom(message.conversationId)).emit('message:updated', { message });
}

export function broadcastReactionUpdated(
  conversationId: number,
  messageId: number,
  reactions: { userId: number; emoji: string }[]
): void {
  getIo().to(conversationRoom(conversationId)).emit('message:reaction:updated', { messageId, reactions });
}

export function broadcastConversationNew(conversation: ConversationDto, participantUserIds: number[]): void {
  for (const userId of participantUserIds) {
    getIo().to(userRoom(userId)).emit('conversation:new', { conversation });
  }
}

export function broadcastMemberUpdated(conversationId: number, members: ParticipantDto[]): void {
  getIo().to(conversationRoom(conversationId)).emit('conversation:member:updated', { conversationId, members });
}

export function broadcastReadUpdated(conversationId: number, userId: number, lastReadMessageId: number): void {
  getIo().to(conversationRoom(conversationId)).emit('conversation:read:updated', {
    conversationId,
    userId,
    lastReadMessageId,
  });
}

export function registerSocketServer(io: Server): void {
  ioRef = io;
  io.use(authenticateSocket);

  io.on('connection', async (socket) => {
    const authed = socket as AuthenticatedSocket;
    const userId = authed.userId;

    presenceService.addConnection(userId, socket.id);
    await socket.join(userRoom(userId));

    const activeConversationIds = await participantsRepository.activeConversationIdsForUser(userId);
    await Promise.all(activeConversationIds.map((id) => socket.join(conversationRoom(id))));

    registerConversationHandlers(authed);
    registerMessageHandlers(authed);
    registerTypingHandlers(authed);

    socket.on('disconnect', () => {
      presenceService.removeConnection(userId, socket.id);
    });
  });
}
