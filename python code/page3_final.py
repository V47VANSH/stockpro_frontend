import psycopg
import redis
import json
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel
from app.config.settings import host, dbname, user, password

# --- new model & encoder --------------------------------------------
class ActiveSignal(BaseModel):
    id: int
    symbol: str
    generation_time: datetime
    type: str
    entry: Decimal
    sl: Decimal
    tsl: Decimal
    t1: Decimal
    t2: Decimal
    t3: Decimal
    t1_hit: bool
    t2_hit: bool
    t3_hit: bool
    t1_hit_time: datetime | None
    t2_hit_time: datetime | None
    t3_hit_time: datetime | None
    highest_price: Decimal | None
    lowest_price: Decimal | None
    last_tsl_update: datetime | None
    tsl_at_closing: Decimal | None
    closing_time: datetime | None
    closing_reason: str | None
    status: str
    yellow_at_generation: Decimal | None
    prev_yellow_at_generation: Decimal | None
    dema_at_generation: Decimal | None
    fib_61_at_generation: Decimal | None
    fib_38_at_generation: Decimal | None
    trendline_at_generation: Decimal | None
    close_price_at_generation: Decimal | None

class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)

# --- existing code...
def fetch_active_signals(conn, tf):
    cur = conn.cursor()
    cur.execute(f"SELECT * FROM signals_{tf}_new WHERE status = 'ACTIVE'")
    cols = [desc[0] for desc in cur.description]
    rows = cur.fetchall()
    cur.close()
    raw = [dict(zip(cols, row)) for row in rows]
    return [ActiveSignal(**r) for r in raw]

def store_signals_to_redis(r, key, signals):
    payload = [sig.model_dump() for sig in signals]
    r.set(key, json.dumps(payload, cls=DateTimeEncoder))

def page3(conn, redis_client, tf: int):
    """
    Fetch and store active signals for a single timeframe tf.
    """
    sigs = fetch_active_signals(conn, tf)
    store_signals_to_redis(redis_client, f"active_signals_{tf}", sigs)

if __name__ == "__main__":
    # ...existing code...
    with psycopg.connect(host=host, dbname=dbname, user=user, password=password) as conn:
        r = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
        # call for a single tf, e.g., 5 or 60
        tf = 5
        page3(conn, r, tf)
        print(f"Stored {tf}-min active signals to Redis.")
