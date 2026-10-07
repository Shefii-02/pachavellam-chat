import type { AuthenticatedSocket } from '../../middleware/authenticateSocket.js';
import { conversationRoom } from '../index.js';

function emitTyping(socket: AuthenticatedSocket, conversationId: number, isTyping: boolean): void {
  socket.to(conversationRoom(conversationId)).emit('typing:update', {
    conversationId,
    userId: socket.userId,
    isTyping,
  });
}

export function registerTypingHandlers(socket: AuthenticatedSocket): void {
  socket.on('typing:start', ({ conversationId }: { conversationId: number }) => {
    emitTyping(socket, conversationId, true);
  });

  socket.on('typing:stop', ({ conversationId }: { conversationId: number }) => {
    emitTyping(socket, conversationId, false);
  });
}
