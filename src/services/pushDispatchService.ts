import { env } from '../config/env.js';

export interface PushPayload {
  recipientUserIds: number[];
  title: string;
  body: string;
  data: Record<string, string>;
}

export const pushDispatchService = {
  /** Best-effort — a push failure must never break message sending. */
  async dispatch(payload: PushPayload): Promise<void> {
    if (payload.recipientUserIds.length === 0) return;
    if (!env.laravelInternalPushUrl || !env.chatPushInternalSecret) return;

    try {
      await fetch(env.laravelInternalPushUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': env.chatPushInternalSecret,
        },
        body: JSON.stringify({
          recipient_user_ids: payload.recipientUserIds,
          title: payload.title,
          body: payload.body,
          data: payload.data,
        }),
      });
    } catch (err) {
      console.error('pushDispatchService: failed to reach Laravel internal push endpoint', err);
    }
  },
};
