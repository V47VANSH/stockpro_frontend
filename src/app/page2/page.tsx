'use client';
import { useEffect, useState } from 'react';

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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch all event types in parallel
        const [breakoutRes, vwapRes, camarillaRes, volumeRes] = await Promise.all([
          fetch('/api/get_hilo'),
          fetch('/api/get_vwap'),
          fetch('/api/get_camrilla'),
          fetch('/api/get_val')
        ]);
        
        // Check responses
        if (!breakoutRes.ok) throw new Error(`Breakout data error: ${breakoutRes.status}`);
        if (!vwapRes.ok) throw new Error(`VWAP data error: ${vwapRes.status}`);
        if (!camarillaRes.ok) throw new Error(`Camarilla data error: ${camarillaRes.status}`);
        if (!volumeRes.ok) throw new Error(`Volume data error: ${volumeRes.status}`);

        // Parse data
        const breakoutData = await breakoutRes.json();
        const vwapData = await vwapRes.json();
        const camarillaData = await camarillaRes.json();
        const volumeData = await volumeRes.json();

        // Sort data by timestamp (newest first) - create new sorted arrays to avoid mutating original
        setBreakoutEvents(
          [...breakoutData].sort((a: BreakoutEvent, b: BreakoutEvent) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
        );
        
        setVwapEvents(
          [...vwapData].sort((a: VWAPEvent, b: VWAPEvent) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
        );
        
        setCamarillaEvents(
          [...camarillaData].sort((a: CamarillaEvent, b: CamarillaEvent) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
        );
        
        setVolumeEvents(
          [...volumeData].sort((a: VolumeEvent, b: VolumeEvent) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
        );
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch market events data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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
