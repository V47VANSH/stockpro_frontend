import type { NextApiRequest, NextApiResponse } from 'next';
import { getRedisClient } from '@/lib/redis';
import { getSSEHub } from '../../lib/sseHub';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Get timeframe from query params, default to 5 minutes if not provided
  const { tf = '5' } = req.query;
  
  if (typeof tf !== 'string') {
    return res.status(400).json({ error: 'Timeframe must be a string value' });
  }

  // Validate timeframe
  const validTimeframes = ['5', '15', '30', '60', '240', '1440'];
  if (!validTimeframes.includes(tf)) {
    return res.status(400).json({ 
      error: 'Invalid timeframe. Supported values: 5, 15, 30, 60, 240, 1440',
      validTimeframes 
    });
  }

  const wantsSSE = (req.headers.accept || '').includes('text/event-stream') || req.query.stream === '1';

  if (!wantsSSE) {
    try {
      const redis = await getRedisClient();
      const redisKey = `active_signals_${tf}`;
      const data = await redis.get(redisKey);
      
      if (!data) return res.status(404).json({ 
        error: `No active signals found for ${tf}-minute timeframe`,
        timeframe: tf
      });

      // Parse data from Redis
      const signals = JSON.parse(data);
      
      res.status(200).json(signals);
    } catch (err) {
      console.error('Error fetching signals:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
    return;
  }

  // SSE stream via Pub/Sub hub
  try {
    const hub = getSSEHub();
    const redisKey = `active_signals_${tf}`;
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
    if (initial) send('update', JSON.parse(initial)); else send('init', { message: `No active signals found for ${tf}-minute timeframe` });
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
    console.error('SSE setup error (get_signal):', err);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Internal Server Error' })}\n\n`);
    res.end();
  }
}
