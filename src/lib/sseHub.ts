import { createClient, type RedisClientType } from 'redis';
import { getRedisClient } from './redis';

type Listener = (message: string) => void;

class SSEHub {
  private subClient: RedisClientType | null = null;
  private ready: Promise<void> | null = null;
  private listeners: Map<string, Set<Listener>> = new Map();
  private refCount: Map<string, number> = new Map();

  private async ensureSubscriber() {
    if (this.subClient && this.subClient.isOpen) return;
    if (!this.ready) {
      this.subClient = createClient();
      this.subClient.on('error', (err) => console.error('Redis Sub Error:', err));
      this.ready = this.subClient.connect();
    }
    await this.ready;
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
        for (const l of set) {
          try { l(message as unknown as string); } catch {}
        }
      });
    }

    return () => {
      const set = this.listeners.get(channel);
      if (set) set.delete(listener);
      const count = (this.refCount.get(channel) || 1) - 1;
      if (count <= 0) {
        this.refCount.delete(channel);
        this.listeners.delete(channel);
        this.subClient?.unsubscribe(channel).catch(() => {});
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
