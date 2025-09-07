import { createClient, type RedisClientType } from 'redis';
import { getRedisClient } from './redis';

type Listener = (message: string) => void;

class SSEHub {
  private subClient: RedisClientType | null = null;
  private ready: Promise<void> | null = null;
  private listeners: Map<string, Set<Listener>> = new Map();
  private refCount: Map<string, number> = new Map();
  // Track last activity time and idle timeout (ms)
  private lastActivity = Date.now();
  private idleTimeoutMs = 60_000; // 1 minute
  private idleTimer: NodeJS.Timeout | null = null;

  private async ensureSubscriber() {
    if (this.subClient && this.subClient.isOpen) return;
    if (!this.ready) {
      this.subClient = createClient();
      this.subClient.on('error', (err) => console.error('Redis Sub Error:', err));
      // ensure Promise<void> regardless of connect() return type
      this.ready = this.subClient.connect().then(() => undefined);
    }
    await this.ready;
    this.touch();
  }

  private touch() {
    this.lastActivity = Date.now();
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => this.shutdownIfIdle(), this.idleTimeoutMs);
  }

  private async shutdownIfIdle() {
    const age = Date.now() - this.lastActivity;
    if (age >= this.idleTimeoutMs && this.subClient) {
      try {
        // unsubscribe from all channels and quit client
        for (const ch of this.listeners.keys()) {
          try { await this.subClient.unsubscribe(ch); } catch {}
        }
        await this.subClient.quit();
      } catch (e) {
        // ignore errors during shutdown
      }
      this.subClient = null;
      this.ready = null;
      this.idleTimer = null;
    }
  }

  async subscribe(channel: string, listener: Listener): Promise<() => void> {
    await this.ensureSubscriber();

    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }
    this.listeners.get(channel)!.add(listener);

    const current = (this.refCount.get(channel) || 0) + 1;
    this.refCount.set(channel, current);

    if (current === 1) {
      await this.subClient!.subscribe(channel, (message) => {
        const set = this.listeners.get(channel);
        if (!set || set.size === 0) return;
        // copy to avoid mutation during iteration
        const copy = Array.from(set);
        for (const l of copy) {
          try { l(message as unknown as string); } catch {}
        }
        this.touch();
      });
    }

    return () => {
      const set = this.listeners.get(channel);
      if (set) set.delete(listener);
      const count = (this.refCount.get(channel) || 1) - 1;
      if (count <= 0) {
        this.refCount.delete(channel);
        this.listeners.delete(channel);
  // unsubscribe and touch
  this.subClient?.unsubscribe(channel).catch(() => {});
  this.touch();
      } else {
        this.refCount.set(channel, count);
      }
    };
  }

  async getInitial(key: string): Promise<string | null> {
    const client = await getRedisClient();
    const data = await client.get(key);
    return data;
  }
}

let singleton: SSEHub | null = null;

export function getSSEHub() {
  if (!singleton) singleton = new SSEHub();
  return singleton;
}
