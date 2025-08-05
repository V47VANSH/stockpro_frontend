import type { NextApiRequest, NextApiResponse } from 'next';
import { getRedisClient } from '@/lib/redis';

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
}
