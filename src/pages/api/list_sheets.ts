import { NextApiRequest, NextApiResponse } from 'next';
import { query as pgQuery } from '../../lib/postgres';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { prefix, q } = req.query as { prefix?: string; q?: string };
    const params: string[] = [];
    const where: string[] = ["table_schema = 'public'", "table_type = 'BASE TABLE'", "table_name NOT LIKE 'pg_%'", "table_name NOT LIKE 'sql_%'"];

    if (prefix) {
      params.push(`${prefix}%`);
      where.push(`table_name LIKE $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      where.push(`table_name ILIKE $${params.length}`);
    }

    const sql = `
      SELECT table_name
      FROM information_schema.tables
      WHERE ${where.join(' AND ')}
      ORDER BY table_name ASC
    `;

    const result = await pgQuery(sql, params);
    const sheets = (result.rows as Array<{ table_name: string }>).map((r) => r.table_name);
    res.status(200).json({ sheets });
  } catch (err) {
    console.error('list_sheets error', err);
    res.status(500).json({ error: 'Failed to fetch sheets' });
  }
}
