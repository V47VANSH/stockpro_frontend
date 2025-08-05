// lib/redis.js
import { createClient } from 'redis';

let client = null;

export async function getRedisClient() {
  if (!client) {
    client = createClient();
    client.on('error', (err) => console.error('Redis Error:', err));
    await client.connect();
  }
  return client;
}
