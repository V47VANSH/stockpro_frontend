
import type { NextApiRequest, NextApiResponse } from 'next';
import { getRedisClient } from '@/lib/redis';
import { getSSEHub } from '../../lib/sseHub';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const wantsSSE = (req.headers.accept || '').includes('text/event-stream') || req.query.stream === '1';

  if (!wantsSSE) {
    try {
      const client = await getRedisClient();
      const data = await client.get('breakout_events');
      if (!data) return res.status(404).json({ error: 'No breakout data found' });

      res.status(200).json(JSON.parse(data));
    } catch (err) {
      console.error('Breakout error:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
    return;
  }

  try {
    const hub = getSSEHub();
    const redisKey = 'breakout_events';
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

    const initial = await hub.getInitial(redisKey);
    if (initial) send('update', JSON.parse(initial)); else send('init', { message: 'No breakout data found' });
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
    console.error('SSE setup error (get_hilo):', err);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Internal Server Error' })}\n\n`);
    res.end();
  }
}