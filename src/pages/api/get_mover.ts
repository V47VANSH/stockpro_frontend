import type { NextApiRequest, NextApiResponse } from 'next';
import { getRedisClient } from '@/lib/redis';
import { getSSEHub } from '../../lib/sseHub';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { index } = req.query;
  
  if (!index || typeof index !== 'string') {
    return res.status(400).json({ error: 'Index parameter is required' });
  }

  const validIndices = ['sensex', 'bankex', 'nifty50', 'banknifty', 'niftymidcap'];
  if (!validIndices.includes(index)) {
    return res.status(400).json({ error: 'Invalid index. Supported indices: sensex, bankex, nifty50, banknifty, niftymidcap' });
  }

  const wantsSSE = (req.headers.accept || '').includes('text/event-stream') || req.query.stream === '1';

  if (!wantsSSE) {
    try {
      const redis = await getRedisClient();
      const redisKey = `stock_movers:${index}`;
      const data = await redis.get(redisKey);
      if (!data) return res.status(404).json({ error: `No data found for index: ${index}` });

      res.status(200).json(JSON.parse(data));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
    return;
  }

  // SSE stream with Redis Pub/Sub hub (O(keys))
  try {
    const hub = getSSEHub();
    const redisKey = `stock_movers:${index}`;
    const channel = `chan:${redisKey}`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    // @ts-ignore
    res.flushHeaders?.();

    let closed = false;
    const send = (event: string, data: any) => {
      if (closed) return;
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      res.write(`event: ${event}\n`);
      res.write(`data: ${payload}\n\n`);
    };

    const heartbeat = setInterval(() => {
      if (!closed) res.write(`event: ping\ndata: ${Date.now()}\n\n`);
    }, 15000);

    // Initial state
    const initial = await hub.getInitial(redisKey);
    if (initial) send('update', JSON.parse(initial)); else send('init', { message: `No data found for index: ${index}` });

  const unsubscribe = await hub.subscribe(channel, (message: string) => {
      try { send('update', JSON.parse(message)); } catch {}
    });

    req.on('close', () => {
      closed = true;
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
  } catch (err) {
    console.error('SSE setup error (get_mover):', err);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Internal Server Error' })}\n\n`);
    res.end();
  }
}
