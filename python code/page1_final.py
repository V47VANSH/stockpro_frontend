from app.functions.bsedat import get_sensex_pullers_draggers
from app.functions.nsedat import get_pullers_draggers

from typing import List, Tuple, Dict
from pydantic import BaseModel


class StockMovers(BaseModel):
    pullers: List[Tuple[str, float]]
    draggers: List[Tuple[str, float]]

import redis
import json

# Create Redis client (adjust host/port as needed)
r = redis.Redis(host='localhost', port=6379, decode_responses=True)

def fetch_stock_movers() -> Dict[str, StockMovers]:
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
    
    if bankex_data:
        bankex_movers = StockMovers(pullers=bankex_data.get('pullers', []), draggers=bankex_data.get('draggers', []))
        payload = bankex_movers.model_dump_json()
        r.set("stock_movers:bankex", payload)
        r.publish("chan:stock_movers:bankex", payload)
        indices_data['bankex'] = bankex_movers
    
    if nifty_data:
        nifty_movers = StockMovers(pullers=nifty_data.get('pullers', []), draggers=nifty_data.get('draggers', []))
        payload = nifty_movers.model_dump_json()
        r.set("stock_movers:nifty50", payload)
        r.publish("chan:stock_movers:nifty50", payload)
        indices_data['nifty50'] = nifty_movers
    
    if banknifty_data:
        banknifty_movers = StockMovers(pullers=banknifty_data.get('pullers', []), draggers=banknifty_data.get('draggers', []))
        payload = banknifty_movers.model_dump_json()
        r.set("stock_movers:banknifty", payload)
        r.publish("chan:stock_movers:banknifty", payload)
        indices_data['banknifty'] = banknifty_movers
    
    if niftymidcap_data:
        niftymidcap_movers = StockMovers(pullers=niftymidcap_data.get('pullers', []), draggers=niftymidcap_data.get('draggers', []))
        payload = niftymidcap_movers.model_dump_json()
        r.set("stock_movers:niftymidcap", payload)
        r.publish("chan:stock_movers:niftymidcap", payload)
        indices_data['niftymidcap'] = niftymidcap_movers
    
    return indices_data


##############################################################################################
##############################################################################################
#USE fetch_stock_movers()
##############################################################################################
##############################################################################################
if __name__ == "__main__":
    all_movers = fetch_stock_movers()
    for index_name, movers in all_movers.items():
        print(f"{index_name}: {movers}")

