'use client';
import { useEffect, useState } from 'react';

interface NDayHighLow {
  timestamp: string;
  symbol: string;
  type: string; // 'high' or 'low'
  value: number;
}

interface Vals {
  timestamp: string;
  symbol: string;
  value: number;
}

interface VWAP {
  timestamp: string;
  symbol: string;
  type: string;
  vwap: number;
}

interface Camarilla {
  timestamp: string;
  symbol: string;
  type: string;
  camarilla: number;
}

export default function MarketDataPage() {
  const [camarillaData, setCamarillaData] = useState<Camarilla[]>([]);
  const [breakoutData, setBreakoutData] = useState<NDayHighLow[]>([]);
  const [volumeData, setVolumeData] = useState<Vals[]>([]);
  const [vwapData, setVwapData] = useState<VWAP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [camarillaRes, breakoutRes, volumeRes, vwapRes] = await Promise.allSettled([
        fetch('/api/get_camrilla'),
        fetch('/api/get_hilo'),
        fetch('/api/get_val'),
        fetch('/api/get_vwap')
      ]);

      if (camarillaRes.status === 'fulfilled' && camarillaRes.value.ok) {
        const data = await camarillaRes.value.json();
        // Sort by timestamp, newest first
        const sortedData = Array.isArray(data) 
          ? [...data].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          : [];
        setCamarillaData(sortedData);
      }

      if (breakoutRes.status === 'fulfilled' && breakoutRes.value.ok) {
        const data = await breakoutRes.value.json();
        // Sort by timestamp, newest first
        const sortedData = Array.isArray(data) 
          ? [...data].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          : [];
        setBreakoutData(sortedData);
      }

      if (volumeRes.status === 'fulfilled' && volumeRes.value.ok) {
        const data = await volumeRes.value.json();
        // Sort by timestamp, newest first
        const sortedData = Array.isArray(data) 
          ? [...data].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          : [];
        setVolumeData(sortedData);
      }

      if (vwapRes.status === 'fulfilled' && vwapRes.value.ok) {
        const data = await vwapRes.value.json();
        // Sort by timestamp, newest first
        const sortedData = Array.isArray(data) 
          ? [...data].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          : [];
        setVwapData(sortedData);
      }
    } catch (err) {
      setError('Failed to fetch market data');
      console.error('Market data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getTypeColor = (type: string) => {
    if (type === 'high' || type === 'bullish' || type === 'buy') return 'text-green-600';
    if (type === 'low' || type === 'bearish' || type === 'sell') return 'text-red-600';
    return 'text-blue-600';
  };

  const getTypeBadgeColor = (type: string) => {
    if (type === 'high' || type === 'bullish' || type === 'buy') return 'bg-green-100 text-green-800';
    if (type === 'low' || type === 'bearish' || type === 'sell') return 'bg-red-100 text-red-800';
    return 'bg-blue-100 text-blue-800';
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">📊 Market Data Dashboard</h1>
          <p className="text-gray-600">Real-time market events and trading signals</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600 text-center">⚠️ {error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading market data...</p>
          </div>
        )}

        {/* Data Tables */}
        {!loading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Camarilla Events */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-purple-600 text-white px-6 py-4">
                <h2 className="text-xl font-semibold flex items-center">
                  🎯 Camarilla Events ({camarillaData.length})
                </h2>
              </div>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Camarilla</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {camarillaData.length > 0 ? camarillaData.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.symbol}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">₹{item.camarilla?.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-center">
                          <span className={`px-2 py-1 rounded-full text-xs ${getTypeBadgeColor(item.type)}`}>
                            {item.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-center">
                          {formatTime(item.timestamp)}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                          No Camarilla events available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* High/Low Events */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-orange-600 text-white px-6 py-4">
                <h2 className="text-xl font-semibold flex items-center">
                  📈 High/Low Events ({breakoutData.length})
                </h2>
              </div>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {breakoutData.length > 0 ? breakoutData.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.symbol}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">₹{item.value?.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-center">
                          <span className={`font-semibold ${getTypeColor(item.type)}`}>
                            {item.type.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-center">
                          {formatTime(item.timestamp)}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                          No high/low events available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Volume Events */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-blue-600 text-white px-6 py-4">
                <h2 className="text-xl font-semibold flex items-center">
                  📊 Volume Events ({volumeData.length})
                </h2>
              </div>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {volumeData.length > 0 ? volumeData.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.symbol}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          {item.value?.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-center">
                          {formatTime(item.timestamp)}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                          No volume events available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* VWAP Events */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-green-600 text-white px-6 py-4">
                <h2 className="text-xl font-semibold flex items-center">
                  📈 VWAP Events ({vwapData.length})
                </h2>
              </div>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">VWAP</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {vwapData.length > 0 ? vwapData.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.symbol}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">₹{item.vwap?.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-center">
                          <span className={`px-2 py-1 rounded-full text-xs ${getTypeBadgeColor(item.type)}`}>
                            {item.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-center">
                          {formatTime(item.timestamp)}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                          No VWAP events available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        {!loading && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">🎯</span>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-gray-900">Camarilla</h3>
                  <p className="text-xl font-bold text-purple-600">{camarillaData.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">📈</span>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-gray-900">High/Low</h3>
                  <p className="text-xl font-bold text-orange-600">{breakoutData.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">📊</span>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-gray-900">Volume</h3>
                  <p className="text-xl font-bold text-blue-600">{volumeData.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">📈</span>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-gray-900">VWAP</h3>
                  <p className="text-xl font-bold text-green-600">{vwapData.length}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
