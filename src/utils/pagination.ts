export const DEFAULT_PAGE_SIZE = 30;
export const MAX_PAGE_SIZE = 100;

export function clampLimit(raw: unknown, fallback = DEFAULT_PAGE_SIZE): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.trunc(n), MAX_PAGE_SIZE);
}

/** Cursor for the conversation list: `${last_message_at_iso}|${id}`. */
export function encodeConversationCursor(lastMessageAt: Date | null, id: number): string {
  const ts = (lastMessageAt ?? new Date(0)).toISOString();
  return Buffer.from(`${ts}|${id}`).toString('base64url');
}

export function decodeConversationCursor(cursor: string): { lastMessageAt: Date; id: number } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const [ts, idStr] = decoded.split('|');
    const id = Number(idStr);
    const lastMessageAt = new Date(ts);
    if (Number.isNaN(id) || Number.isNaN(lastMessageAt.getTime())) return null;
    return { lastMessageAt, id };
  } catch {
    return null;
  }
}

/** Cursor for the message list is just the last seen message id (bigint PK). */
export function decodeMessageCursor(cursor: unknown): number | null {
  const id = Number(cursor);
  return Number.isFinite(id) && id > 0 ? id : null;
}
