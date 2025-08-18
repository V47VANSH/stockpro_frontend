'use client';
import { useEffect, useRef, useState } from 'react';

interface BreakoutEvent {
  timestamp: string;
  symbol: string;
  type: string;  // 'high' or 'low'
  value: number;
}

interface VWAPEvent {
  timestamp: string;
  symbol: string;
  type: string; // 'above' or 'below'
  vwap: number;
}

interface CamarillaEvent {
  timestamp: string;
  symbol: string;
  type: string; // 'h4', 'h5', 'l4', or 'l5'
  camarilla: number;
}

interface VolumeEvent {
  timestamp: string;
  symbol: string;
  value: number; // volume value
}

export default function MarketDataPage() {
  const [breakoutEvents, setBreakoutEvents] = useState<BreakoutEvent[]>([]);
  const [vwapEvents, setVwapEvents] = useState<VWAPEvent[]>([]);
  const [camarillaEvents, setCamarillaEvents] = useState<CamarillaEvent[]>([]);
  const [volumeEvents, setVolumeEvents] = useState<VolumeEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamsCleanup = useRef<null | (() => void)>(null);

  useEffect(() => {
    // Close existing streams if any
    streamsCleanup.current?.();
    setLoading(true);
    setError(null);

    const sortByTime = <T extends { timestamp: string }>(arr: T[]) =>
      [...arr].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const esList: EventSource[] = [];
    const connect = (url: string, onData: (data: any) => void) => {
      if (typeof window === 'undefined' || !('EventSource' in window)) {
        fetch(url.replace('&stream=1', ''))
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Error: ${r.status}`))))
          .then(onData)
          .catch((e) => setError(e.message))
          .finally(() => setLoading(false));
        return;
      }
      const es = new EventSource(url);
      const onUpdate = (ev: MessageEvent) => {
        try {
          const parsed = JSON.parse(ev.data);
          onData(parsed);
          setLoading(false);
        } catch {}
      };
      const onError = () => {
        setError('Connection lost');
        setLoading(false);
      };
      es.addEventListener('update', onUpdate as EventListener);
      es.addEventListener('init', onUpdate as EventListener);
      es.addEventListener('error', onError as EventListener);
      es.onerror = onError as any;
      esList.push(es);
    };

    connect('/api/get_hilo?stream=1', (data) => {
      const arr = Array.isArray(data) ? sortByTime<BreakoutEvent>(data) : [];
      setBreakoutEvents(arr);
    });
    connect('/api/get_vwap?stream=1', (data) => {
      const arr = Array.isArray(data) ? sortByTime<VWAPEvent>(data) : [];
      setVwapEvents(arr);
    });
    connect('/api/get_camrilla?stream=1', (data) => {
      const arr = Array.isArray(data) ? sortByTime<CamarillaEvent>(data) : [];
      setCamarillaEvents(arr);
    });
    connect('/api/get_val?stream=1', (data) => {
      const arr = Array.isArray(data) ? sortByTime<VolumeEvent>(data) : [];
      setVolumeEvents(arr);
    });

    const cleanup = () => esList.forEach((es) => es.close());
    streamsCleanup.current = cleanup;
    return cleanup;
  }, []);

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatValue = (value: number) => {
    return value.toFixed(2);
  };

  return (
    <main className="bg-gray-50 p-6 min-h-[calc(100vh-4rem)]">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">📊 Market Events Dashboard</h1>
          <p className="text-gray-600">Latest breakouts, VWAP crossings, Camarilla levels, and volume events</p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading market events data...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600 text-center">⚠️ {error}</p>
          </div>
        )}

        {/* Content Grid */}
        {!loading && !error && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Breakout Events Card */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-purple-600 text-white px-6 py-4">
                <h2 className="text-xl font-semibold">🔔 Breakout Events ({breakoutEvents.length})</h2>
                <p className="text-sm opacity-80">7-day highs and lows</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {breakoutEvents.length > 0 ? (
                      breakoutEvents.map((event, index) => (
                        <tr key={`${event.symbol}-${event.timestamp}-${index}`} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {formatDateTime(event.timestamp)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {event.symbol}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              event.type.toLowerCase() === 'high' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {event.type.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-right">
                            {formatValue(event.value)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                          No breakout events today
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* VWAP Events Card */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-blue-600 text-white px-6 py-4">
                <h2 className="text-xl font-semibold">📉 VWAP Crossings ({vwapEvents.length})</h2>
                <p className="text-sm opacity-80">Price crossing weekly VWAP</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Direction</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">VWAP</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {vwapEvents.length > 0 ? (
                      vwapEvents.map((event, index) => (
                        <tr key={`${event.symbol}-${event.timestamp}-${index}`} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {formatDateTime(event.timestamp)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {event.symbol}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              event.type.toLowerCase() === 'above' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {event.type.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-right">
                            {formatValue(event.vwap)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                          No VWAP crossing events today
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Camarilla Events Card */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-amber-600 text-white px-6 py-4">
                <h2 className="text-xl font-semibold">🎯 Camarilla Levels ({camarillaEvents.length})</h2>
                <p className="text-sm opacity-80">Price crossing key Camarilla levels</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {camarillaEvents.length > 0 ? (
                      camarillaEvents.map((event, index) => (
                        <tr key={`${event.symbol}-${event.timestamp}-${index}`} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {formatDateTime(event.timestamp)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {event.symbol}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              event.type.toLowerCase().startsWith('h') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {event.type.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-right">
                            {formatValue(event.camarilla)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                          No Camarilla level events today
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Volume Events Card */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-teal-600 text-white px-6 py-4">
                <h2 className="text-xl font-semibold">📊 Unusual Volume ({volumeEvents.length})</h2>
                <p className="text-sm opacity-80">Stocks trading at unusual volume</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Volume Ratio</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {volumeEvents.length > 0 ? (
                      volumeEvents.map((event, index) => (
                        <tr key={`${event.symbol}-${event.timestamp}-${index}`} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {formatDateTime(event.timestamp)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {event.symbol}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-right">
                            {formatValue(event.value)}x
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-gray-500">
                          No unusual volume events today
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
