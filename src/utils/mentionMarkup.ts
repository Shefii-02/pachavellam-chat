const MENTION_PATTERN = /@\[(\d+):[^\]]*\]/g;

/** Extracts user ids from `@[userId:Name]` markup embedded in a message body. */
export function extractMentionedUserIds(body: string | null | undefined): number[] {
  if (!body) return [];
  const ids: number[] = [];
  for (const match of body.matchAll(MENTION_PATTERN)) {
    const id = Number(match[1]);
    if (Number.isFinite(id)) ids.push(id);
  }
  return ids;
}
