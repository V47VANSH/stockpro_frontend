'use client';
import { useEffect, useState } from 'react';

interface ActiveSignal {
  id: number;
  symbol: string;
  generation_time: string;
  type: string;
  entry: number;
  sl: number;
  tsl: number;
  t1: number;
  t2: number;
  t3: number;
  t1_hit: boolean;
  t2_hit: boolean;
  t3_hit: boolean;
  t1_hit_time: string | null;
  t2_hit_time: string | null;
  t3_hit_time: string | null;
  highest_price: number | null;
  lowest_price: number | null;
  last_tsl_update: string | null;
  tsl_at_closing: number | null;
}

export default function SignalsPage() {
  const [signals, setSignals] = useState<ActiveSignal[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState('5');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timeframes = [
    { value: '5', label: '5 Min' },
    { value: '15', label: '15 Min' },
    { value: '30', label: '30 Min' },
    { value: '60', label: '1 Hour' },
    { value: '240', label: '4 Hour' },
    { value: '1440', label: 'Daily' },
  ];

  const fetchSignals = async (tf: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/get_signal?tf=${tf}`);
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      const result = await response.json();
      
      // Sort signals by generation_time, latest first
      const sortedSignals = result.sort((a: ActiveSignal, b: ActiveSignal) => 
        new Date(b.generation_time).getTime() - new Date(a.generation_time).getTime()
      );
      
      setSignals(sortedSignals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch signals');
      setSignals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals(selectedTimeframe);
  }, [selectedTimeframe]);

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return '-';
    return price.toFixed(2);
  };

  return (
    <main className="bg-gray-50 p-6 min-h-[calc(100vh-4rem)]">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">📊 Active Trading Signals</h1>
          <p className="text-gray-600">Latest trading signals with targets and stop-loss levels</p>
        </div>
        
        {/* Timeframe Selector */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg shadow-md p-2 flex space-x-2">
            {timeframes.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setSelectedTimeframe(tf.value)}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  selectedTimeframe === tf.value
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading signals...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600 text-center">⚠️ {error}</p>
          </div>
        )}

        {/* Data Display */}
        {signals.length > 0 && !loading && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Generated</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Entry</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">SL</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">TSL</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Target 1</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Target 2</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Target 3</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {signals.map((signal) => (
                    <tr key={signal.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {signal.symbol}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          signal.type.toLowerCase() === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {signal.type}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(signal.generation_time)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold text-right">
                        {formatPrice(signal.entry)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-red-600 font-semibold text-right">
                        {formatPrice(signal.sl)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-orange-600 font-semibold text-right">
                        {formatPrice(signal.tsl)}
                      </td>
                      <td className={`px-4 py-4 whitespace-nowrap text-sm text-right font-semibold ${
                        signal.t1_hit ? 'text-green-600 line-through' : 'text-blue-600'
                      }`}>
                        {formatPrice(signal.t1)}
                        {signal.t1_hit && <span className="ml-1 text-xs">✓</span>}
                      </td>
                      <td className={`px-4 py-4 whitespace-nowrap text-sm text-right font-semibold ${
                        signal.t2_hit ? 'text-green-600 line-through' : 'text-blue-600'
                      }`}>
                        {formatPrice(signal.t2)}
                        {signal.t2_hit && <span className="ml-1 text-xs">✓</span>}
                      </td>
                      <td className={`px-4 py-4 whitespace-nowrap text-sm text-right font-semibold ${
                        signal.t3_hit ? 'text-green-600 line-through' : 'text-blue-600'
                      }`}>
                        {formatPrice(signal.t3)}
                        {signal.t3_hit && <span className="ml-1 text-xs">✓</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {signals.length === 0 && !loading && !error && (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <p className="text-gray-500">No active signals at this time</p>
          </div>
        )}
      </div>
    </main>
  );
}
