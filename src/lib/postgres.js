import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || 'postgres://postgres:2478@localhost:5432/StockMarket',
  // You can add more config options as needed
});

export async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}

export default pool;
