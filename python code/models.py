"""
Database Models for StockPro Backend
====================================

This file contains all CREATE TABLE statements found in datahistory.py 
and the functions folder and its subfolders.
"""

import psycopg2 
from typing import Optional

host = 'localhost'
dbname='StockMarketData'
user='postgres'
password="2478"
autocommit=True
rhost = 'localhost'
rport = 6379
# =============================================================================
# FROM datahistory.py
# =============================================================================

def create_ohlc_live_long_table(conn):
    """Create main OHLC data table with hypertable partitioning"""
    cur = conn.cursor()
    cur.execute("""
    CREATE TABLE IF NOT EXISTS ohlc_live_long (
        timestamp TIMESTAMPTZ NOT NULL,
        symbol TEXT NOT NULL,
        open NUMERIC NOT NULL,
        high NUMERIC NOT NULL,
        low NUMERIC NOT NULL,
        close NUMERIC NOT NULL,
        volume BIGINT NOT NULL,
        PRIMARY KEY (timestamp, symbol)
    );
    """)
    cur.execute("""
    SELECT create_hypertable('ohlc_live_long', 'timestamp', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_ohlc_live_long_symbol_ts ON ohlc_live_long (symbol, timestamp DESC);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_ohlc_live_long_ts ON ohlc_live_long (timestamp DESC);")
    conn.commit()
    cur.close()


# =============================================================================
# FROM app/functions/vwap_crossing.py
# =============================================================================

def create_vwap_cross_events_table(conn, tf: str, period: str):
    """Create VWAP crossing events table for given timeframe and period"""
    cur = conn.cursor()
    cur.execute(f"""
        CREATE TABLE IF NOT EXISTS {period}_vwap_cross_events_{tf} (
            timestamp TIMESTAMPTZ NOT NULL,
            symbol TEXT NOT NULL,
            open NUMERIC NOT NULL,
            high NUMERIC NOT NULL,
            low NUMERIC NOT NULL,
            close NUMERIC NOT NULL,
            vwap DOUBLE PRECISION NOT NULL,
            crossed_above BOOLEAN NOT NULL,
            crossed_below BOOLEAN NOT NULL,
            PRIMARY KEY (timestamp, symbol)
        );
    """)
    conn.commit()
    cur.close()


# =============================================================================
# FROM app/functions/vwap_camrilla_peridioc_history_store.py
# =============================================================================

def create_vwap_camarilla_periodic_tables(conn, period: str):
    """
    Create VWAP and Camarilla tables for periodic data (weekly/monthly)
    period: 'weekly' or 'monthly'
    """
    with conn.cursor() as cur:
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS vwap_{period} (
                {period}  TEXT NOT NULL,
                symbol    TEXT NOT NULL,
                vwap      DOUBLE PRECISION,
                PRIMARY KEY ({period}, symbol)
            );
        """)
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS camarilla_{period} (
                {period}  TEXT NOT NULL,
                symbol    TEXT NOT NULL,
                h5 DOUBLE PRECISION,
                h4 DOUBLE PRECISION,
                h3 DOUBLE PRECISION,
                h2 DOUBLE PRECISION,
                h1 DOUBLE PRECISION,
                l1 DOUBLE PRECISION,
                l2 DOUBLE PRECISION,
                l3 DOUBLE PRECISION,
                l4 DOUBLE PRECISION,
                l5 DOUBLE PRECISION,
                PRIMARY KEY ({period}, symbol)
            );
        """)
    conn.commit()


# =============================================================================
# FROM app/functions/vwap_camrilla_history_store.py
# =============================================================================

def create_vwap_table(conn):
    """Create daily VWAP table"""
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS vwap (
                date    DATE NOT NULL,
                symbol  TEXT NOT NULL,
                vwap    DOUBLE PRECISION,
                PRIMARY KEY (date, symbol)
            );
        """)
    conn.commit()


def create_camarilla_table(conn):
    """Create daily Camarilla levels table"""
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS camarilla (
                date    DATE NOT NULL,
                symbol  TEXT NOT NULL,
                h5 DOUBLE PRECISION,
                h4 DOUBLE PRECISION,
                h3 DOUBLE PRECISION,
                h2 DOUBLE PRECISION,
                h1 DOUBLE PRECISION,
                l1 DOUBLE PRECISION,
                l2 DOUBLE PRECISION,
                l3 DOUBLE PRECISION,
                l4 DOUBLE PRECISION,
                l5 DOUBLE PRECISION,
                PRIMARY KEY (date, symbol)
            );
        """)
    conn.commit()


# =============================================================================
# FROM app/functions/val_crossing.py
# =============================================================================

def create_unusual_volume_events_table(conn):
    """Create table to store unusual volume events"""
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS unusual_volume_events (
                timestamp TIMESTAMPTZ NOT NULL,
                symbol TEXT NOT NULL,
                open NUMERIC NOT NULL,
                high NUMERIC NOT NULL,
                low NUMERIC NOT NULL,
                close NUMERIC NOT NULL,
                volume BIGINT NOT NULL,
                value_traded BIGINT NOT NULL,  -- close * volume
                threshold_value BIGINT NOT NULL,  -- 16 crores
                created_at TIMESTAMPTZ DEFAULT NOW(),
                PRIMARY KEY (timestamp, symbol)
            );
        """)
        # Create indexes for better performance
        cur.execute("CREATE INDEX IF NOT EXISTS idx_unusual_volume_symbol_time ON unusual_volume_events (symbol, timestamp DESC);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_unusual_volume_time ON unusual_volume_events (timestamp DESC);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_unusual_volume_value ON unusual_volume_events (value_traded DESC);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_unusual_volume_created ON unusual_volume_events (created_at DESC);")
    conn.commit()


# =============================================================================
# FROM app/functions/nday_high_low_crossing.py
# =============================================================================

def create_prevnday_hilo_table(conn, days: int = 7):
    """Create table for storing N-day high/low data"""
    with conn.cursor() as cur:
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS prev{days}day_hilo (
                date DATE NOT NULL,
                symbol TEXT NOT NULL,
                high NUMERIC,
                low NUMERIC,
                PRIMARY KEY (date, symbol)
            );
        """)
    conn.commit()


def create_breakout_events_table(conn, days: int = 7):
    """Create table for storing breakout events"""
    with conn.cursor() as cur:
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS breakout_events{days} (
                date        DATE NOT NULL,
                symbol      TEXT NOT NULL,
                event_time  TIMESTAMPTZ NOT NULL,
                event_type  TEXT NOT NULL, -- 'HIGH' or 'LOW'
                candle_time TIMESTAMPTZ NOT NULL,
                candle_high NUMERIC NOT NULL,
                candle_low  NUMERIC NOT NULL,
                candle_close NUMERIC NOT NULL,
                prev{days}d_high NUMERIC NOT NULL,
                prev{days}d_low  NUMERIC NOT NULL,
                PRIMARY KEY (date, symbol)
            );
        """)
    conn.commit()


# =============================================================================
# FROM app/functions/camarilla_crossing.py
# =============================================================================

def create_camarilla_cross_events_table(conn, tf: str, period: str):
    """Create table for Camarilla level crossing events"""
    cur = conn.cursor()
    cur.execute(f"""
        CREATE TABLE IF NOT EXISTS {period}_camarilla_cross_events_{tf} (
            timestamp TIMESTAMPTZ NOT NULL,
            symbol TEXT NOT NULL,
            open NUMERIC NOT NULL,
            high NUMERIC NOT NULL,
            low NUMERIC NOT NULL,
            close NUMERIC NOT NULL,
            h4 DOUBLE PRECISION,
            h5 DOUBLE PRECISION,
            l4 DOUBLE PRECISION,
            l5 DOUBLE PRECISION,
            crossed_above TEXT,
            crossed_below TEXT,
            PRIMARY KEY (timestamp, symbol)
        );
    """)
    conn.commit()
    cur.close()


# =============================================================================
# FROM app/functions/page3/yellow.py
# =============================================================================

def create_yellow_table(conn, tf: str):
    """Create yellow indicator table for given timeframe"""
    with conn.cursor() as cur:
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS yellow_{tf}_new (
                timestamp TIMESTAMPTZ NOT NULL,
                symbol TEXT NOT NULL,
                yellow NUMERIC NOT NULL,
                PRIMARY KEY (timestamp, symbol)
            );
        """)
    conn.commit()


# =============================================================================
# FROM app/functions/page3/signal.py
# =============================================================================

def create_signals_table(conn, tf: str):
    """
    Create a comprehensive table for storing trading signals for multiple timeframes.
    Enhanced with target tracking, TSL updates, and indicator values at generation time.
    """
    cur = conn.cursor()
    cur.execute(f"""
        CREATE TABLE IF NOT EXISTS signals_{tf}_new (
            id SERIAL PRIMARY KEY,
            symbol TEXT NOT NULL,
            generation_time TIMESTAMPTZ NOT NULL,
            type TEXT NOT NULL CHECK (type IN ('BUY', 'SELL')),
            entry NUMERIC NOT NULL,
            sl NUMERIC NOT NULL,
            tsl NUMERIC NOT NULL,
            t1 NUMERIC NOT NULL,
            t2 NUMERIC NOT NULL,
            t3 NUMERIC NOT NULL,
            t1_hit BOOLEAN DEFAULT FALSE,
            t2_hit BOOLEAN DEFAULT FALSE,
            t3_hit BOOLEAN DEFAULT FALSE,
            t1_hit_time TIMESTAMPTZ,
            t2_hit_time TIMESTAMPTZ,
            t3_hit_time TIMESTAMPTZ,
            highest_price NUMERIC,
            lowest_price NUMERIC,
            last_tsl_update TIMESTAMPTZ,
            tsl_at_closing NUMERIC,
            closing_time TIMESTAMPTZ,
            closing_reason TEXT,
            status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED')),
            yellow_at_generation NUMERIC,
            prev_yellow_at_generation NUMERIC,
            dema_at_generation NUMERIC,
            fib_61_at_generation NUMERIC,
            fib_38_at_generation NUMERIC,
            bb_upper_at_generation NUMERIC,
            bb_lower_at_generation NUMERIC,
            trendline_at_generation NUMERIC,
            close_price_at_generation NUMERIC,
            UNIQUE(symbol, generation_time, type)
        );
        
        CREATE INDEX IF NOT EXISTS idx_signals_{tf}_symbol_time ON signals_{tf}_new (symbol, generation_time DESC);
        CREATE INDEX IF NOT EXISTS idx_signals_{tf}_status ON signals_{tf}_new (status);
    """)
    conn.commit()
    cur.close()


# =============================================================================
# FROM app/functions/page3/fibbo.py
# =============================================================================

def create_fibonacci_table(conn, tf: str):
    """Create Fibonacci retracement levels table for given timeframe"""
    cur = conn.cursor()
    cur.execute(f"""
        CREATE TABLE IF NOT EXISTS fibonacci_{tf}_new (
            timestamp TIMESTAMPTZ NOT NULL,
            symbol TEXT NOT NULL,
            fib_61 NUMERIC NOT NULL,
            fib_38 NUMERIC NOT NULL,
            PRIMARY KEY (timestamp, symbol)
        );
    """)
    conn.commit()
    cur.close()


# =============================================================================
# FROM app/functions/page3/dema.py
# =============================================================================

def create_dema_table(conn, tf: int):
    """Create DEMA (Double Exponential Moving Average) table for given timeframe"""
    with conn.cursor() as cur:
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS dema_talib_{tf}_new (
                timestamp TIMESTAMPTZ NOT NULL,
                symbol TEXT NOT NULL,
                dema NUMERIC NOT NULL,
                PRIMARY KEY (timestamp, symbol)
            );
        """)
    conn.commit()


# =============================================================================
# FROM app/functions/page3/bbatr.py
# =============================================================================

def create_bb_atr_table(conn, tf: str):
    """Create Bollinger Bands + ATR table for given timeframe"""
    with conn.cursor() as cur:
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS bb_atr_{tf}_new (
                timestamp TIMESTAMPTZ NOT NULL,
                symbol TEXT NOT NULL,
                bb_upper NUMERIC NOT NULL,
                bb_lower NUMERIC NOT NULL,
                bb_signal INT NOT NULL,
                trendline NUMERIC NOT NULL,
                trend INT NOT NULL,
                PRIMARY KEY (timestamp, symbol)
            );
        """)
    conn.commit()


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def create_all_tables(conn, timeframes: list = ['5', '15', '30', '60'], periods: list = ['daily', 'weekly', 'monthly']):
    """
    Create all tables for the StockPro application
    
    Args:
        conn: Database connection
        timeframes: List of timeframes (e.g., ['5', '15', '30', '60'])
        periods: List of periods (e.g., ['daily', 'weekly', 'monthly'])
    """
    # Core tables
    create_ohlc_live_long_table(conn)
    create_unusual_volume_events_table(conn)
    create_vwap_table(conn)
    create_camarilla_table(conn)
    
    # Period-specific tables
    for period in periods:
        if period in ['weekly', 'monthly']:
            create_vwap_camarilla_periodic_tables(conn, period)
    
    # N-day high/low tables (commonly used with 7 days)
    create_prevnday_hilo_table(conn, 7)
    create_breakout_events_table(conn, 7)
    
    # Timeframe-specific tables
    for tf in timeframes:
        # Technical indicator tables
        create_yellow_table(conn, tf)
        create_fibonacci_table(conn, tf)
        create_dema_table(conn, int(tf))
        create_bb_atr_table(conn, tf)
        create_signals_table(conn, tf)
        
        # Crossing event tables
        for period in periods:
            create_vwap_cross_events_table(conn, tf, period)
            create_camarilla_cross_events_table(conn, tf, period)
    
    print("All tables created successfully!")


def get_table_creation_sql() -> str:
    """
    Returns SQL script with all table creation statements
    Can be used for database migrations or documentation
    """
    sql_statements = []
    
    # Add each CREATE TABLE statement as a string
    # This is useful for generating migration scripts
    
    return "\n\n".join(sql_statements)


if __name__ == "__main__":
    # Example usage
    from app.config.settings import host, dbname, user, password
    
    conn = psycopg2.connect(
        host=host,
        dbname=dbname,
        user=user,
        password=password
    )
    
    # Create all tables with default timeframes and periods
    create_all_tables(conn)
    
    conn.close()
    print("Database models setup completed!")