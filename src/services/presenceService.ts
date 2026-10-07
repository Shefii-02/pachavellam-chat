/**
 * Tracks which userIds currently have at least one open socket connection.
 * In-memory, single-process only — if this service is ever scaled beyond
 * one Node instance, this needs a shared store (e.g. Redis) instead.
 */
class PresenceService {
  private socketsByUser = new Map<number, Set<string>>();

  addConnection(userId: number, socketId: string): void {
    const set = this.socketsByUser.get(userId) ?? new Set<string>();
    set.add(socketId);
    this.socketsByUser.set(userId, set);
  }

  removeConnection(userId: number, socketId: string): void {
    const set = this.socketsByUser.get(userId);
    if (!set) return;
    set.delete(socketId);
    if (set.size === 0) this.socketsByUser.delete(userId);
  }

  isOnline(userId: number): boolean {
    return this.socketsByUser.has(userId);
  }

  /** Splits a list of user ids into those currently connected vs. not. */
  partitionByPresence(userIds: number[]): { online: number[]; offline: number[] } {
    const online: number[] = [];
    const offline: number[] = [];
    for (const id of userIds) {
      (this.isOnline(id) ? online : offline).push(id);
    }
    return { online, offline };
  }
}

export const presenceService = new PresenceService();
