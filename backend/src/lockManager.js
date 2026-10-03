export class LockManager {
  constructor() {
    this.locks = new Map();
  }

  lock(ticketId, socketId, agentName) {
    const existing = this.locks.get(ticketId);
    if (existing) return { ok: false, existing };

    const lock = { ticketId, socketId, agentName };
    this.locks.set(ticketId, lock);
    return { ok: true, lock };
  }

  unlock(ticketId, socketId, reason = 'manual') {
    const existing = this.locks.get(ticketId);
    if (!existing) return { ok: false, reason: 'not_locked' };
    if (existing.socketId !== socketId) return { ok: false, reason: 'not_owner', existing };

    this.locks.delete(ticketId);
    return { ok: true, lock: { ...existing, reason } };
  }

  releaseSocket(socketId, reason = 'disconnect') {
    const released = [];
    for (const [ticketId, lock] of this.locks.entries()) {
      if (lock.socketId === socketId) {
        this.locks.delete(ticketId);
        released.push({ ...lock, reason });
      }
    }
    return released;
  }

  list() {
    return [...this.locks.values()];
  }
}
