from app.functions.bsedat import get_sensex_pullers_draggers
from app.functions.nsedat import get_pullers_draggers
from app.config.settings import rhost, rport, host, dbname, user, password

from datetime import datetime
from typing import List, Tuple, Dict
from pydantic import BaseModel
from datetime import datetime, timedelta
import psycopg2 as psycopg


class StockMovers(BaseModel):
    pullers: List[Tuple[str, float]]
    draggers: List[Tuple[str, float]]
class AdvanceDecline(BaseModel):
    AD_sensex: List[Tuple[datetime, int, int]]
    AD_nifty: List[Tuple[datetime, int, int]]
    AD_banknifty: List[Tuple[datetime, int, int]]
    AD_midcap: List[Tuple[datetime, int, int]]
    AD_smallcap: List[Tuple[datetime, int, int]]

import redis
import json

# Create Redis client (adjust host/port as needed)
r = redis.Redis(host=rhost, port=rport, db=0, decode_responses=True)

def create_movers_table():
    """Create the movers table if it doesn't exist"""
    conn = psycopg.connect(host=host, dbname=dbname, user=user, password=password)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS movers (
                    timestamp TIMESTAMPTZ NOT NULL,
                    symbol TEXT NOT NULL,
                    pullers INTEGER NOT NULL DEFAULT 0,
                    draggers INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (timestamp, symbol)
                );
                
                -- Create index for efficient querying
                CREATE INDEX IF NOT EXISTS idx_movers_timestamp ON movers(timestamp);
                CREATE INDEX IF NOT EXISTS idx_movers_symbol ON movers(symbol);
            """)
        conn.commit()
    finally:
        conn.close()

def store_movers_data(timestamp: datetime, index_name: str, pullers_count: int, draggers_count: int):
    """Store movers data in PostgreSQL"""
    conn = psycopg.connect(host=host, dbname=dbname, user=user, password=password)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO movers (timestamp, symbol, pullers, draggers)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (timestamp, symbol) 
                DO UPDATE SET 
                    pullers = EXCLUDED.pullers,
                    draggers = EXCLUDED.draggers
            """, (timestamp, index_name, pullers_count, draggers_count))
        conn.commit()
    finally:
        conn.close()

def store_advance_decline_redis():
    """Store latest 5 advance/decline datapoints from movers table to Redis"""
    conn = psycopg.connect(host=host, dbname=dbname, user=user, password=password)
    try:
        with conn.cursor() as cur:
            # Fetch up to 375 latest datapoints per symbol using a window function
            cur.execute("""
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
            """)
            rows = cur.fetchall()

            # Group by symbol; rows are newest-first per symbol because of ORDER BY
            data_by_symbol = {
                'sensex': [],
                'nifty50': [],
                'banknifty': [],
                'niftymidcap': [],
                'bankex': []
            }

            for timestamp, symbol, pullers, draggers in rows:
                if symbol in data_by_symbol:
                    data_by_symbol[symbol].append((timestamp, pullers, draggers))
            
            # Create AdvanceDecline object
            advance_decline = AdvanceDecline(
                AD_sensex=data_by_symbol['sensex'],
                AD_nifty=data_by_symbol['nifty50'],
                AD_banknifty=data_by_symbol['banknifty'],
                AD_midcap=data_by_symbol['niftymidcap'],
                AD_smallcap=data_by_symbol['bankex']  # Using bankex as smallcap placeholder
            )
            
            # Store in Redis (no expiry) and publish the payload
            payload = advance_decline.model_dump_json()
            r.set("advance_decline:latest", payload)
            r.publish("chan:advance_decline", payload)

            print(f"Stored advance/decline data (up to 375 points per index) for {len([k for k, v in data_by_symbol.items() if v])} indices")
            
    finally:
        conn.close()

def fetch_stock_movers() -> Dict[str, StockMovers]:
    # Ensure table exists
    create_movers_table()
    
    # Get current timestamp (rounded to minute with 00 seconds)
    current_time = datetime.now().replace(second=0, microsecond=0)
    
    # Fetch data from all indices
    sensex_data = get_sensex_pullers_draggers(index_code="16")  # SENSEX index code
    bankex_data = get_sensex_pullers_draggers(index_code="53")  # BANKEX index code
    nifty_data = get_pullers_draggers(index_name="NIFTY 50")
    banknifty_data = get_pullers_draggers(index_name="NIFTY BANK")
    niftymidcap_data = get_pullers_draggers(index_name="NIFTY MIDCAP SELECT")
    
    # Create separate StockMovers objects for each index
    indices_data = {}
    
    if sensex_data:
        sensex_movers = StockMovers(pullers=sensex_data.get('pullers', []), draggers=sensex_data.get('draggers', []))
        payload = sensex_movers.model_dump_json()
        r.set("stock_movers:sensex", payload)
        r.publish("chan:stock_movers:sensex", payload)
        indices_data['sensex'] = sensex_movers
        
        # Store in PostgreSQL
        pullers_count = len(sensex_data.get('pullers', []))
        draggers_count = len(sensex_data.get('draggers', []))
        store_movers_data(current_time, 'sensex', pullers_count, draggers_count)
    
    if bankex_data:
        bankex_movers = StockMovers(pullers=bankex_data.get('pullers', []), draggers=bankex_data.get('draggers', []))
        payload = bankex_movers.model_dump_json()
        r.set("stock_movers:bankex", payload)
        r.publish("chan:stock_movers:bankex", payload)
        indices_data['bankex'] = bankex_movers
        
        # Store in PostgreSQL
        pullers_count = len(bankex_data.get('pullers', []))
        draggers_count = len(bankex_data.get('draggers', []))
        store_movers_data(current_time, 'bankex', pullers_count, draggers_count)
    
    if nifty_data:
        nifty_movers = StockMovers(pullers=nifty_data.get('pullers', []), draggers=nifty_data.get('draggers', []))
        payload = nifty_movers.model_dump_json()
        r.set("stock_movers:nifty50", payload)
        r.publish("chan:stock_movers:nifty50", payload)
        indices_data['nifty50'] = nifty_movers
        
        # Store in PostgreSQL
        pullers_count = len(nifty_data.get('pullers', []))
        draggers_count = len(nifty_data.get('draggers', []))
        store_movers_data(current_time, 'nifty50', pullers_count, draggers_count)
    
    if banknifty_data:
        banknifty_movers = StockMovers(pullers=banknifty_data.get('pullers', []), draggers=banknifty_data.get('draggers', []))
        payload = banknifty_movers.model_dump_json()
        r.set("stock_movers:banknifty", payload)
        r.publish("chan:stock_movers:banknifty", payload)
        indices_data['banknifty'] = banknifty_movers
        
        # Store in PostgreSQL
        pullers_count = len(banknifty_data.get('pullers', []))
        draggers_count = len(banknifty_data.get('draggers', []))
        store_movers_data(current_time, 'banknifty', pullers_count, draggers_count)
    
    if niftymidcap_data:
        niftymidcap_movers = StockMovers(pullers=niftymidcap_data.get('pullers', []), draggers=niftymidcap_data.get('draggers', []))
        payload = niftymidcap_movers.model_dump_json()
        r.set("stock_movers:niftymidcap", payload)
        r.publish("chan:stock_movers:niftymidcap", payload)
        indices_data['niftymidcap'] = niftymidcap_movers
        
        # Store in PostgreSQL
        pullers_count = len(niftymidcap_data.get('pullers', []))
        draggers_count = len(niftymidcap_data.get('draggers', []))
        store_movers_data(current_time, 'niftymidcap', pullers_count, draggers_count)

    # Store advance/decline data in Redis after all data is processed
    store_advance_decline_redis()

    return indices_data


##############################################################################################
##############################################################################################
#USE fetch_stock_movers()
##############################################################################################
##############################################################################################
if __name__ == "__main__":
    start_time = datetime.now()
    all_movers = fetch_stock_movers()
    for index_name, movers in all_movers.items():
        print(f"{index_name}: {movers}")
    end_time = datetime.now()
    print(f"Time taken: {end_time - start_time} seconds")


