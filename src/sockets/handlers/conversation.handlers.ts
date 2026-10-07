import type { AuthenticatedSocket } from '../../middleware/authenticateSocket.js';
import { conversationService } from '../../services/conversationService.js';
import { conversationRoom } from '../index.js';

export function registerConversationHandlers(socket: AuthenticatedSocket): void {
  socket.on('conversation:join', async ({ conversationId }: { conversationId: number }) => {
    try {
      await conversationService.assertActiveParticipant(conversationId, socket.userId);
      await socket.join(conversationRoom(conversationId));
    } catch {
      // Silently ignore — the client simply won't receive events for a
      // conversation it isn't actually part of.
    }
  });

  socket.on('conversation:leave', async ({ conversationId }: { conversationId: number }) => {
    await socket.leave(conversationRoom(conversationId));
  });
}
