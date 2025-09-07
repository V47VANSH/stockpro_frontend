import psycopg2
import redis
import json
from typing import List, Tuple, Dict
from pydantic import BaseModel
from datetime import datetime
from app.config.settings import host, dbname, user, password , rhost, rport


class NDayHighLow(BaseModel):
    timestamp: datetime
    symbol: str
    type: str  # 'high' or 'low'
    value: float

class Vals(BaseModel):
    timestamp: datetime
    symbol: str
    value: float
class VWAP(BaseModel):
    timestamp: datetime
    symbol: str
    type: str 
    vwap: float
class Camarilla(BaseModel):
    timestamp: datetime
    symbol: str
    type: str 
    camarilla: float

def fetch_breakout_events(conn) -> List[NDayHighLow]:
    cur = conn.cursor()
    cur.execute("""
        SELECT 
            symbol,
            event_time,
            event_type,
            CASE 
                WHEN event_type = 'HIGH' THEN prev7d_high
                WHEN event_type = 'LOW' THEN prev7d_low
            END AS value
        FROM breakout_events7
        WHERE DATE(event_time) = CURRENT_DATE
    """)
    rows = cur.fetchall()
    cur.close()
    
    events = []
    for row in rows:
        symbol, event_time, event_type, value = row
        event = NDayHighLow(
            timestamp=event_time,
            symbol=symbol,
            type=event_type.lower(),
            value=value
        )
        events.append(event)
    
    return events


def fetch_vwap_cross_events(conn) -> List[VWAP]:
    """
    Fetch VWAP cross events for the current date.
    Returns: List of VWAP models.
    """
    cur = conn.cursor()
    query = """
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
        WHERE DATE(timestamp) = CURRENT_DATE;
    """
    cur.execute(query)
    rows = cur.fetchall()
    cur.close()
    
    events = []
    for row in rows:
        timestamp, symbol, vwap, event_type = row
        event = VWAP(
            timestamp=timestamp,
            symbol=symbol,
            type=event_type,
            vwap=vwap
        )
        events.append(event)
    
    return events

def fetch_camarilla_cross_events(conn, tf, period) -> List[Camarilla]:
    """
    Fetch Camarilla crossing events for the current date.
    Returns: List of Camarilla models.
    """
    cur = conn.cursor()
    query = f"""
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
            END AS value
        FROM {period}_camarilla_cross_events_{tf}
        WHERE DATE(timestamp) = CURRENT_DATE
        AND (crossed_above IN ('h4', 'h5') OR crossed_below IN ('l4', 'l5'));
    """
    cur.execute(query)
    rows = cur.fetchall()
    cur.close()
    
    events = []
    for row in rows:
        ts, symbol, event_type, value = row
        event = Camarilla(
            timestamp=ts,
            symbol=symbol,
            type=event_type,
            camarilla=value
        )
        events.append(event)
    
    return events


def fetch_unusual_volume_events(conn) -> List[Vals]:
    """
    Fetch unusual volume events for the current date.
    Returns: List of Vals models.
    """
    cur = conn.cursor()
    query = """
        SELECT 
            timestamp AS ts,
            symbol,
            value_traded
        FROM unusual_volume_events
        WHERE DATE(timestamp) = CURRENT_DATE;
    """
    cur.execute(query)
    rows = cur.fetchall()
    cur.close()
    
    events = []
    for row in rows:
        ts, symbol, value_traded = row
        event = Vals(
            timestamp=ts,
            symbol=symbol,
            value=value_traded
        )
        events.append(event)
    
    return events

class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

def store_breakout_events_to_redis(redis_client, events: List[NDayHighLow], key: str = "breakout_events"):
    """Store breakout events to Redis as JSON."""
    data = [event.model_dump() for event in events]
    payload = json.dumps(data, cls=DateTimeEncoder)
    redis_client.set(key, payload)
    redis_client.publish(f"chan:{key}", payload)

def store_vwap_events_to_redis(redis_client, events: List[VWAP], key: str = "vwap_events"):
    """Store VWAP cross events to Redis as JSON."""
    data = [event.model_dump() for event in events]
    payload = json.dumps(data, cls=DateTimeEncoder)
    redis_client.set(key, payload)
    redis_client.publish(f"chan:{key}", payload)

def store_camarilla_events_to_redis(redis_client, events: List[Camarilla], key: str = "camarilla_events"):
    """Store Camarilla cross events to Redis as JSON."""
    data = [event.model_dump() for event in events]
    payload = json.dumps(data, cls=DateTimeEncoder)
    redis_client.set(key, payload)
    redis_client.publish(f"chan:{key}", payload)

def store_volume_events_to_redis(redis_client, events: List[Vals], key: str = "volume_events"):
    """Store unusual volume events to Redis as JSON."""
    data = [event.model_dump() for event in events]
    payload = json.dumps(data, cls=DateTimeEncoder)
    redis_client.set(key, payload)
    redis_client.publish(f"chan:{key}", payload)

def page2_15(conn, redis_client,tf=15, period='weekly'):
    
    events = fetch_breakout_events(conn)
    events2 = fetch_vwap_cross_events(conn)
    events3 = fetch_camarilla_cross_events(conn, tf=tf, period=period)

    # Store events to Redis
    store_breakout_events_to_redis(redis_client, events)
    store_vwap_events_to_redis(redis_client, events2)
    store_camarilla_events_to_redis(redis_client, events3)


def page2_1(conn, redis_client):
    events4 = fetch_unusual_volume_events(conn)
    store_volume_events_to_redis(redis_client, events4)

##############################################################################################
##############################################################################################
#USE page2_1(conn, redis_client) , page2_15(conn, redis_client,tf=15, period='weekly')
##############################################################################################
##############################################################################################

if __name__ == "__main__":
    conn = psycopg2.connect(host=host, dbname=dbname, user=user, password=password)
    redis_client = redis.Redis(host=rhost, port=rport, db=0, decode_responses=True)

    events = fetch_breakout_events(conn)
    events2 = fetch_vwap_cross_events(conn)
    events3 = fetch_camarilla_cross_events(conn, tf=15, period='weekly')
    events4 = fetch_unusual_volume_events(conn)
    
    # Store events to Redis
    store_breakout_events_to_redis(redis_client, events)
    store_vwap_events_to_redis(redis_client, events2)
    store_camarilla_events_to_redis(redis_client, events3)
    store_volume_events_to_redis(redis_client, events4)
    
    # for event in events3:
    #     print(event)
    conn.close()