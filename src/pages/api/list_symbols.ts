import { NextApiRequest, NextApiResponse } from 'next';
import { query as pgQuery } from '../../lib/postgres';

async function resolveTableWithSymbol(preferred?: string): Promise<string | null> {
  if (preferred) {
    const exists = await pgQuery(
      `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name='symbol' LIMIT 1`,
      [preferred]
    );
    if (exists.rowCount) return preferred;
  }
  const common = await pgQuery(
    `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ohlc_live_long' AND column_name='symbol' LIMIT 1`
  );
  if (common.rowCount) return 'ohlc_live_long';
  const any = await pgQuery(
    `SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='symbol' ORDER BY table_name ASC LIMIT 1`
  );
  if (any.rowCount) return (any.rows[0] as { table_name: string }).table_name;
  return null;
}

// This API is no longer used in Page4 but kept for potential future features
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { sheet, q, limit } = req.query as { sheet?: string; q?: string; limit?: string };
    const table = await resolveTableWithSymbol(sheet);
    if (!table) return res.status(400).json({ error: 'No table with symbol column found' });

    const where: string[] = ['symbol IS NOT NULL'];
    const params: Array<string | number> = [];
    if (q) {
      where.push(`symbol ILIKE $${params.length + 1}`);
      params.push(`%${q}%`);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;
    const lim = Math.min(parseInt(limit || '1000', 10) || 1000, 5000);
    const sql = `SELECT DISTINCT symbol FROM ${table} ${whereSql} ORDER BY symbol ASC LIMIT ${lim}`;
    const result = await pgQuery(sql, params);
    const symbols = (result.rows as Array<{ symbol: string }>).map((r) => r.symbol);
    res.status(200).json({ table, symbols });
  } catch (err) {
    console.error('list_symbols error', err);
    res.status(500).json({ error: 'Failed to fetch symbols' });
  }
}
