import { NextApiRequest, NextApiResponse } from 'next';
import { getRedisClient } from '../../lib/redis.js';
import { query } from '../../lib/postgres.js';
import crypto from 'crypto';

interface AdvanceDeclineData {
  AD_sensex: [string, number, number][];
  AD_nifty: [string, number, number][];
  AD_banknifty: [string, number, number][];
  AD_midcap: [string, number, number][];
  AD_smallcap: [string, number, number][];
}

interface AdvanceDeclinePoint {
  timestamp: string;
  pullers: number;
  draggers: number;
  net: number;
}

interface TransformedData {
  sensex: AdvanceDeclinePoint[];
  nifty: AdvanceDeclinePoint[];
  banknifty: AdvanceDeclinePoint[];
  midcap: AdvanceDeclinePoint[];
  smallcap: AdvanceDeclinePoint[];
}

async function getAdvanceDeclineFromPostgres(): Promise<TransformedData> {
  try {
    // Fetch latest up to 375 datapoints per symbol using a window function
    // We return rows ordered by symbol and timestamp DESC so each symbol's
    // array will be newest-first.
    const result = await query(`
      WITH numbered AS (
        SELECT timestamp, symbol, pullers, draggers,
               ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY timestamp DESC) AS rn
        FROM movers
        WHERE symbol IN ('sensex', 'nifty50', 'banknifty', 'niftymidcap', 'bankex')
      )
      SELECT timestamp, symbol, pullers, draggers
      FROM numbered
      WHERE rn <= 375
      ORDER BY symbol, timestamp DESC
    `, []);

    const dataBySymbol: TransformedData = {
      sensex: [],
      nifty: [],
      banknifty: [],
      midcap: [],
      smallcap: []
    };

    const symbolMapping: Record<string, keyof TransformedData> = {
      'sensex': 'sensex',
      'nifty50': 'nifty',
      'banknifty': 'banknifty',
      'niftymidcap': 'midcap',
      'bankex': 'smallcap'
    };

    interface PostgresRow {
      timestamp: Date;
      symbol: string;
      pullers: number;
      draggers: number;
    }

    // Rows are ordered by symbol then timestamp DESC, so push will produce
    // newest-first arrays per symbol.
    result.rows.forEach((row: PostgresRow) => {
      const mappedSymbol = symbolMapping[row.symbol];
      if (mappedSymbol) {
        dataBySymbol[mappedSymbol].push({
          timestamp: new Date(row.timestamp).toISOString(),
          pullers: row.pullers,
          draggers: row.draggers,
          net: row.pullers - row.draggers
        });
      }
    });

    return dataBySymbol;
  } catch (error) {
    console.error('Error fetching from PostgreSQL:', error);
    throw error;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let transformedData: TransformedData | null = null;
  const redis = await getRedisClient();
  const data = await redis.get('advance_decline:latest');

  let etag: string | null = null;

  if (data) {
    etag = crypto.createHash('md5').update(data).digest('hex');
    const advanceDeclineData: AdvanceDeclineData = JSON.parse(data);

    // If any index has fewer than 100 points, fall back to Postgres and
    // refresh Redis with up to 375 datapoints per index (no expiry).
    const lengths = [
      (advanceDeclineData.AD_sensex || []).length,
      (advanceDeclineData.AD_nifty || []).length,
      (advanceDeclineData.AD_banknifty || []).length,
      (advanceDeclineData.AD_midcap || []).length,
      (advanceDeclineData.AD_smallcap || []).length
    ];

    const hasEnough = lengths.every(l => l >= 100);
    if (hasEnough) {
      transformedData = {
        sensex: advanceDeclineData.AD_sensex.map(([timestamp, pullers, draggers]) => ({
          timestamp: new Date(timestamp).toISOString(),
          pullers,
          draggers,
          net: pullers - draggers
        })),
        nifty: advanceDeclineData.AD_nifty.map(([timestamp, pullers, draggers]) => ({
          timestamp: new Date(timestamp).toISOString(),
          pullers,
          draggers,
          net: pullers - draggers
        })),
        banknifty: advanceDeclineData.AD_banknifty.map(([timestamp, pullers, draggers]) => ({
          timestamp: new Date(timestamp).toISOString(),
          pullers,
          draggers,
          net: pullers - draggers
        })),
        midcap: advanceDeclineData.AD_midcap.map(([timestamp, pullers, draggers]) => ({
          timestamp: new Date(timestamp).toISOString(),
          pullers,
          draggers,
          net: pullers - draggers
        })),
        smallcap: advanceDeclineData.AD_smallcap.map(([timestamp, pullers, draggers]) => ({
          timestamp: new Date(timestamp).toISOString(),
          pullers,
          draggers,
          net: pullers - draggers
        }))
      };
      res.setHeader('ETag', etag);
      return res.status(200).json(transformedData);
    }
    // else fall through to refresh from Postgres
  }

  // If no data in Redis, fetch from Postgres, update Redis, and return
  // If we reached here, either Redis had no data or it had insufficient
  // datapoints. Fetch from Postgres (up to 375 per symbol), update Redis and
  // return the fresh transformed data. Do not set an expiry on the Redis key.
  transformedData = await getAdvanceDeclineFromPostgres();

  // Prepare data in Redis format (arrays of [timestamp, pullers, draggers])
  const advanceDeclineData: AdvanceDeclineData = {
    AD_sensex: transformedData.sensex.map(({ timestamp, pullers, draggers }) => [timestamp, pullers, draggers]),
    AD_nifty: transformedData.nifty.map(({ timestamp, pullers, draggers }) => [timestamp, pullers, draggers]),
    AD_banknifty: transformedData.banknifty.map(({ timestamp, pullers, draggers }) => [timestamp, pullers, draggers]),
    AD_midcap: transformedData.midcap.map(({ timestamp, pullers, draggers }) => [timestamp, pullers, draggers]),
    AD_smallcap: transformedData.smallcap.map(({ timestamp, pullers, draggers }) => [timestamp, pullers, draggers])
  };
  const redisData = JSON.stringify(advanceDeclineData);
  await redis.set('advance_decline:latest', redisData);

  etag = crypto.createHash('md5').update(redisData).digest('hex');
  res.setHeader('ETag', etag);
  return res.status(200).json(transformedData);
}
