import { NextApiRequest, NextApiResponse } from 'next';
import { query as pgQuery } from '../../lib/postgres';
import ExcelJS from 'exceljs';

export const config = {
  api: {
    responseLimit: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { sheet, start, end } = req.query;
  if (!sheet || typeof sheet !== 'string') return res.status(400).json({ error: 'Sheet name required' });
  
  try {
    // Validate table name exists and is in public schema to prevent SQL injection
    const tblCheck = await pgQuery(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = $1`,
      [sheet]
    );
    if (!tblCheck.rowCount) return res.status(400).json({ error: 'Invalid sheet' });

    // Get column information with data types
    const colsRes = await pgQuery(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns 
       WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
      [sheet]
    );
    const columns = colsRes.rows as Array<{ column_name: string; data_type: string; is_nullable: string }>;
    
    // Determine the appropriate date/timestamp column for filtering based on models.py
    let dateColumn = '';
    let orderByColumn = '';
    
    // Priority order based on models.py table definitions
    if (columns.some(col => col.column_name === 'timestamp')) {
      dateColumn = 'timestamp';
      orderByColumn = 'timestamp DESC';
    } else if (columns.some(col => col.column_name === 'generation_time')) {
      dateColumn = 'generation_time';
      orderByColumn = 'generation_time DESC';
    } else if (columns.some(col => col.column_name === 'event_time')) {
      dateColumn = 'event_time';
      orderByColumn = 'event_time DESC';
    } else if (columns.some(col => col.column_name === 'candle_time')) {
      dateColumn = 'candle_time';
      orderByColumn = 'candle_time DESC';
    } else if (columns.some(col => col.column_name === 'created_at')) {
      dateColumn = 'created_at';
      orderByColumn = 'created_at DESC';
    } else if (columns.some(col => col.column_name === 'date')) {
      dateColumn = 'date';
      orderByColumn = 'date DESC';
    } else if (columns.some(col => col.column_name.includes('day') || col.column_name.includes('week') || col.column_name.includes('month'))) {
      // For periodic tables like vwap_weekly, camarilla_monthly
      const periodCol = columns.find(col => col.column_name.includes('day') || col.column_name.includes('week') || col.column_name.includes('month'));
      if (periodCol) {
        dateColumn = periodCol.column_name;
        orderByColumn = `${periodCol.column_name} DESC`;
      }
    }

    // Build the SELECT query with proper column selection to preserve data types and convert timestamps to IST
    const selectCols = columns.map(col => {
      const name = col.column_name;
      // Convert timestamps to IST (Asia/Kolkata) in the query. Alias back to original name so Excel mapping is unchanged.
      if (col.data_type === 'timestamp with time zone') {
        // timestamptz -> local IST timestamp (timestamp without time zone)
        return `${name} AT TIME ZONE 'Asia/Kolkata' AS "${name}"`;
      } else if (col.data_type === 'timestamp without time zone') {
        // assume stored as UTC: convert to timestamptz from UTC, then to local IST time
        return `(${name} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata' AS "${name}"`;
      } else if (col.data_type === 'date') {
        return `"${name}"`;
      } else {
        return `"${name}"`;
      }
    }).join(', ');

    let sql = `SELECT ${selectCols} FROM ${sheet}`;
    const params: any[] = [];
    const filters: string[] = [];

    const startVal = Array.isArray(start) ? start[0] : start;
    const endVal = Array.isArray(end) ? end[0] : end;

    // Helper to produce the same timezone-converted expression for WHERE filtering
    const colExprMap = new Map<string,string>();
    columns.forEach(col => {
      const name = col.column_name;
      if (col.data_type === 'timestamp with time zone') {
        colExprMap.set(name, `${name} AT TIME ZONE 'Asia/Kolkata'`);
      } else if (col.data_type === 'timestamp without time zone') {
        colExprMap.set(name, `(${name} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata'`);
      } else {
        colExprMap.set(name, name);
      }
    });

    // Add date/timestamp filters if we have a date column and filter values (filters operate on IST-converted expression)
    if (dateColumn) {
      const expr = colExprMap.get(dateColumn) || dateColumn;
      const colDef = columns.find(c => c.column_name === dateColumn);
      const colType = colDef ? colDef.data_type : 'text';
      const isDateOnly = (v?: string | null) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

      if (startVal) {
        if (colType === 'date') {
          filters.push(`${expr} >= $${params.length + 1}::date`);
        } else {
          // timestamp-like: if user provided date-only, compare from start of that date
          if (isDateOnly(startVal)) {
            filters.push(`${expr} >= $${params.length + 1}::date`);
          } else {
            filters.push(`${expr} >= $${params.length + 1}::timestamp`);
          }
        }
        params.push(startVal);
      }

      if (endVal) {
        if (colType === 'date') {
          // inclusive for date columns
          filters.push(`${expr} <= $${params.length + 1}::date`);
        } else {
          // timestamp-like: if user provided date-only, include the whole end date by comparing to next day (exclusive)
          if (isDateOnly(endVal)) {
            filters.push(`${expr} < ($${params.length + 1}::date + INTERVAL '1 day')`);
          } else {
            filters.push(`${expr} <= $${params.length + 1}::timestamp`);
          }
        }
        params.push(endVal);
      }
    }
    
    if (filters.length) {
      sql += ' WHERE ' + filters.join(' AND ');
    }
    
    // Add ordering if we have a date column
    if (orderByColumn) {
      sql += ` ORDER BY ${orderByColumn}`;
    }

    const result = await pgQuery(sql, params);
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Sheet');
    
    if (result.rows.length) {
      // Set up columns with proper formatting based on data types
      ws.columns = columns.map(col => {
        const header = col.column_name;
        const columnConfig: any = { header, key: header };
        
        // Set column formatting based on PostgreSQL data types from models.py
        switch (col.data_type) {
          case 'timestamp with time zone':
          case 'timestamp without time zone':
            columnConfig.style = { 
              numFmt: 'yyyy-mm-dd hh:mm:ss.000',
            };
            columnConfig.width = 20;
            break;
          case 'date':
            columnConfig.style = { 
              numFmt: 'yyyy-mm-dd',
            };
            columnConfig.width = 12;
            break;
          case 'numeric':
          case 'double precision':
            columnConfig.style = { 
              numFmt: '0.00000000',
            };
            columnConfig.width = 15;
            break;
          case 'bigint':
          case 'integer':
            columnConfig.style = { 
              numFmt: '0',
            };
            columnConfig.width = 12;
            break;
          case 'text':
          case 'character varying':
            columnConfig.width = 15;
            break;
          case 'boolean':
            columnConfig.width = 8;
            break;
          default:
            columnConfig.width = 15;
        }
        
        return columnConfig;
      });
      
      // Add rows with proper data conversion
      result.rows.forEach(row => {
        const processedRow: any = {};
        columns.forEach(col => {
          const value = row[col.column_name];

          if (value === null || value === undefined) {
            processedRow[col.column_name] = null;
          } else if (col.data_type === 'timestamp with time zone' || col.data_type === 'timestamp without time zone') {
            // Convert to IST and write as string in IST
            const date = new Date(value);
            // Convert to IST (Asia/Kolkata is UTC+5:30)
            const istOffset = 5.5 * 60; // minutes
            const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
            const istDate = new Date(utc + (istOffset * 60000));
            // Format as 'yyyy-mm-dd hh:mm:ss.SSS'
            const pad = (n: number, z = 2) => ('00' + n).slice(-z);
            const formatted = `${istDate.getFullYear()}-${pad(istDate.getMonth() + 1)}-${pad(istDate.getDate())} ${pad(istDate.getHours())}:${pad(istDate.getMinutes())}:${pad(istDate.getSeconds())}.${pad(istDate.getMilliseconds(), 3)}`;
            processedRow[col.column_name] = formatted;
          } else if (col.data_type === 'date') {
            // Convert to IST and write as string 'yyyy-mm-dd'
            const date = new Date(value);
            const istOffset = 5.5 * 60;
            const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
            const istDate = new Date(utc + (istOffset * 60000));
            const pad = (n: number, z = 2) => ('00' + n).slice(-z);
            const formatted = `${istDate.getFullYear()}-${pad(istDate.getMonth() + 1)}-${pad(istDate.getDate())}`;
            processedRow[col.column_name] = formatted;
          } else if (col.data_type === 'numeric' || col.data_type === 'double precision') {
            processedRow[col.column_name] = parseFloat(value);
          } else if (col.data_type === 'bigint' || col.data_type === 'integer') {
            processedRow[col.column_name] = parseInt(value);
          } else if (col.data_type === 'boolean') {
            processedRow[col.column_name] = Boolean(value);
          } else {
            processedRow[col.column_name] = value;
          }
        });
        ws.addRow(processedRow);
      });
    }
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${sheet}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('download_sheet error', err);
    res.status(500).json({ error: 'Failed to generate sheet' });
  }
}
