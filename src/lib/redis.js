// lib/redis.js
import { createClient } from 'redis';

let client = null;
let handlersRegistered = false;

export async function getRedisClient() {
  // Return existing open client when possible
  if (client && client.isOpen) return client;

  // If we have a client but it's not open, try to reconnect once
  if (client && !client.isOpen) {
    try {
      await client.connect();
      if (client.isOpen) return client;
    } catch (e) {
      console.error('Redis reconnect error:', e);
      try { await client.quit(); } catch {};
      client = null;
    }
  }

  // Create a fresh client
  client = createClient();
  client.on('error', (err) => console.error('Redis Error:', err));

  try {
    await client.connect();
  } catch (e) {
    console.error('Redis connect error:', e);
  }

  // Register process exit handlers once to ensure the client is closed on shutdown.
  if (!handlersRegistered && typeof process !== 'undefined' && process && process.on) {
    handlersRegistered = true;
    const cleanup = async () => {
      try {
        if (client && client.isOpen) await client.quit();
      } catch (e) {}
      client = null;
    };
    process.on('exit', cleanup);
    process.on('SIGINT', () => { cleanup().then(() => process.exit(0)); });
    process.on('SIGTERM', () => { cleanup().then(() => process.exit(0)); });
  }

  return client;
}
