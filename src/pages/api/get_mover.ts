import type { NextApiRequest, NextApiResponse } from 'next';
import { getRedisClient } from '@/lib/redis';

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
}
