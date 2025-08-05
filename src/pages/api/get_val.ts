import { getRedisClient } from '@/lib/redis';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const client = await getRedisClient();
    const data = await client.get('volume_events');
    if (!data) return res.status(404).json({ error: 'No Volume data found' });

    res.status(200).json(JSON.parse(data));
  } catch (err) {
    console.error('Volume error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
