import type { AuthenticatedSocket } from '../../middleware/authenticateSocket.js';
import { conversationService } from '../../services/conversationService.js';
import { messageService } from '../../services/messageService.js';
import { broadcastNewMessage, broadcastReadUpdated } from '../index.js';

interface SendMessagePayload {
  conversationId: number;
  clientTempId: string;
  type: 'text';
  body: string;
  replyToMessageId?: number | null;
}

type Ack = (response: { message?: ReturnType<typeof messageService.dtoOf>; clientTempId: string; error?: string }) => void;

export function registerMessageHandlers(socket: AuthenticatedSocket): void {
  socket.on('message:send', async (payload: SendMessagePayload, ack?: Ack) => {
    try {
      if (payload.type !== 'text') {
        throw new Error('Only text messages can be sent over the socket; use the media upload endpoint for others.');
      }
      const message = await messageService.sendText(
        payload.conversationId,
        socket.userId,
        payload.body,
        payload.replyToMessageId ?? null
      );
      broadcastNewMessage(message);
      ack?.({ message, clientTempId: payload.clientTempId });
    } catch (err) {
      ack?.({ clientTempId: payload.clientTempId, error: err instanceof Error ? err.message : 'Failed to send message' });
    }
  });

  socket.on('message:read', async ({ conversationId, lastReadMessageId }: { conversationId: number; lastReadMessageId: number }) => {
    try {
      await conversationService.markRead(conversationId, socket.userId, lastReadMessageId);
      broadcastReadUpdated(conversationId, socket.userId, lastReadMessageId);
    } catch {
      // Best-effort — read receipts are not worth surfacing an error for.
    }
  });
}
