import type { NextApiRequest, NextApiResponse } from 'next';
import { getRedisClient } from '@/lib/redis';
import { query as pgQuery } from '../../lib/postgres';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const redis = await getRedisClient();
    const results: Record<string, boolean> = {};

    // Refresh breakout events
    try {
      const breakoutRes = await pgQuery(`
        SELECT 
          symbol,
          event_time as timestamp,
          event_type as type,
          CASE 
            WHEN event_type = 'HIGH' THEN prev7d_high
            WHEN event_type = 'LOW' THEN prev7d_low
          END AS value
        FROM breakout_events7
        WHERE DATE(event_time) = CURRENT_DATE
      `);
      const breakoutData = JSON.stringify(breakoutRes.rows);
      await redis.set('breakout_events', breakoutData, { EX: 3600 }); // 1 hour expiration
      await redis.publish('chan:breakout_events', breakoutData);
      results.breakout_events = true;
    } catch (err) {
      console.error('Error refreshing breakout events:', err);
      results.breakout_events = false;
    }

    // Refresh VWAP events
    try {
      const vwapRes = await pgQuery(`
        SELECT 
          timestamp, 
          symbol, 
          vwap, 
          CASE 
            WHEN crossed_above = true THEN 'above'
            WHEN crossed_below = true THEN 'below'
            ELSE NULL
          END AS type
        FROM weekly_vwap_cross_events_15
        WHERE DATE(timestamp) = CURRENT_DATE
      `);
      const vwapData = JSON.stringify(vwapRes.rows);
      await redis.set('vwap_events', vwapData, { EX: 3600 });
      await redis.publish('chan:vwap_events', vwapData);
      results.vwap_events = true;
    } catch (err) {
      console.error('Error refreshing VWAP events:', err);
      results.vwap_events = false;
    }

    // Refresh Camarilla events
    try {
      const camarillaRes = await pgQuery(`
        SELECT 
          timestamp AS ts,
          symbol,
          CASE
            WHEN crossed_above = 'h4' THEN 'h4'
            WHEN crossed_above = 'h5' THEN 'h5'
            WHEN crossed_below = 'l4' THEN 'l4'
            WHEN crossed_below = 'l5' THEN 'l5'
            ELSE NULL
          END AS type,
          CASE
            WHEN crossed_above = 'h4' THEN h4
            WHEN crossed_above = 'h5' THEN h5
            WHEN crossed_below = 'l4' THEN l4
            WHEN crossed_below = 'l5' THEN l5
            ELSE NULL
          END AS camarilla
        FROM weekly_camarilla_cross_events_15
        WHERE DATE(timestamp) = CURRENT_DATE
        AND (crossed_above IN ('h4', 'h5') OR crossed_below IN ('l4', 'l5'))
      `);
      const camarillaData = JSON.stringify(camarillaRes.rows);
      await redis.set('camarilla_events', camarillaData, { EX: 3600 });
      await redis.publish('chan:camarilla_events', camarillaData);
      results.camarilla_events = true;
    } catch (err) {
      console.error('Error refreshing Camarilla events:', err);
      results.camarilla_events = false;
    }

    // Refresh volume events
    try {
      const volumeRes = await pgQuery(`
        SELECT 
          timestamp AS ts,
          symbol,
          value_traded as value
        FROM unusual_volume_events
        WHERE DATE(timestamp) = CURRENT_DATE
      `);
      const volumeData = JSON.stringify(volumeRes.rows);
      await redis.set('volume_events', volumeData, { EX: 3600 });
      await redis.publish('chan:volume_events', volumeData);
      results.volume_events = true;
    } catch (err) {
      console.error('Error refreshing volume events:', err);
      results.volume_events = false;
    }

    // Refresh active signals for different timeframes
    const timeframes = ['5', '60'];
    for (const tf of timeframes) {
      try {
        const signalsRes = await pgQuery(`SELECT * FROM signals_${tf}_new WHERE status = 'ACTIVE'`);
        const signalsData = JSON.stringify(signalsRes.rows);
        const redisKey = `active_signals_${tf}`;
        await redis.set(redisKey, signalsData, { EX: 3600 });
        await redis.publish(`chan:${redisKey}`, signalsData);
        results[`active_signals_${tf}`] = true;
      } catch (err) {
        console.error(`Error refreshing signals for ${tf}min timeframe:`, err);
        results[`active_signals_${tf}`] = false;
      }
    }

    const successCount = Object.values(results).filter(Boolean).length;
    const totalCount = Object.keys(results).length;

    res.status(200).json({
      message: `Refreshed ${successCount}/${totalCount} data sources`,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Error in refresh_all_data:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
