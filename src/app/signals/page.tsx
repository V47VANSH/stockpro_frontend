'use client';
import { useEffect, useState } from 'react';

interface ActiveSignal {
  id: number;
  symbol: string;
  generation_time: string;
  type: string;
  entry: number | string;
  sl: number | string;
  tsl: number | string;
  t1: number | string;
  t2: number | string;
  t3: number | string;
  t1_hit: boolean;
  t2_hit: boolean;
  t3_hit: boolean;
  t1_hit_time: string | null;
  t2_hit_time: string | null;
  t3_hit_time: string | null;
  highest_price: number | string | null;
  lowest_price: number | string | null;
  last_tsl_update: string | null;
  tsl_at_closing: number | string | null;
}

export default function SignalsPage() {
  const [signals, setSignals] = useState<ActiveSignal[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState('5');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timeframes = [
    { value: '5', label: 'Scalp' },
    { value: '60', label: 'Swing' },
  ];

  const connectSSE = (tf: string) => {
    setLoading(true);
    setError(null);
    try {
      if (typeof window === 'undefined' || !('EventSource' in window)) {
        fetch(`/api/get_signal?tf=${tf}`)
          .then(async (r) => {
            if (!r.ok) throw new Error(`Error: ${r.status}`);
            return r.json();
          })
          .then((data) => {
            const sorted = Array.isArray(data)
              ? data.sort((a: ActiveSignal, b: ActiveSignal) => new Date(b.generation_time).getTime() - new Date(a.generation_time).getTime())
              : [];
            setSignals(sorted);
          })
          .catch((e) => {
            setError(e instanceof Error ? e.message : 'Failed to fetch signals');
            setSignals([]);
          })
          .finally(() => setLoading(false));
        return () => {};
      }

      const es = new EventSource(`/api/get_signal?tf=${tf}&stream=1`);
      const onUpdate = (ev: MessageEvent) => {
        try {
          const data = JSON.parse(ev.data);
          const sorted = Array.isArray(data)
            ? data.sort((a: ActiveSignal, b: ActiveSignal) => new Date(b.generation_time).getTime() - new Date(a.generation_time).getTime())
            : [];
          setSignals(sorted);
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
      return () => es.close();
    } catch (e) {
      setError('Failed to connect');
      setLoading(false);
      return () => {};
    }
  };

  useEffect(() => {
    const cleanup = connectSSE(selectedTimeframe);
    return cleanup;
  }, [selectedTimeframe]);

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatPrice = (price: number | string | null) => {
    if (price === null || price === undefined) return '-';
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(numPrice)) return '-';
    return numPrice.toFixed(2);
  };

  return (
    <main className="p-6 min-h-[calc(100vh-4rem)]" style={{ background: 'var(--background)' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-strong mb-2">📊 Active Trading Signals</h1>
          <p className="text-muted">Latest trading signals with targets and stop-loss levels</p>
        </div>
        
        {/* Timeframe Selector */}
        <div className="flex justify-center mb-8">
          <div className="rounded-lg p-2 flex space-x-2 bg-card border border-default shadow-card">
            {timeframes.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setSelectedTimeframe(tf.value)}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  selectedTimeframe === tf.value
                    ? 'shadow-lg'
                    : 'hover-surface'
                }`}
                style={selectedTimeframe === tf.value ? { background: 'var(--accent)', color: 'var(--on-accent)' } : undefined}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--accent)' }}></div>
            <p className="mt-2 text-muted">Loading signals...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-lg p-4 mb-6" style={{ background: 'var(--card-bg)', border: '1px solid rgba(220,38,38,0.12)' }}>
            <p className="text-red-600 text-center">⚠️ {error}</p>
          </div>
        )}

        {/* Data Display */}
        {signals.length > 0 && !loading && (
          <div className="rounded-lg overflow-hidden bg-card border border-default">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="table-head">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Symbol</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Generated</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">Entry</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">SL</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">TSL</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">Target 1</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">Target 2</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">Target 3</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ background: 'var(--card-bg)' }}>
                  {signals.map((signal) => (
                    <tr key={signal.id} className="hover-surface transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-strong">
                        {signal.symbol}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-muted">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          signal.type.toLowerCase() === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {signal.type}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-muted">
                        {formatDate(signal.generation_time)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-strong font-semibold text-right">
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
          <div className="text-center py-12 rounded-lg shadow-card bg-card border border-default">
            <p className="text-muted">No active signals at this time</p>
          </div>
        )}
      </div>
    </main>
  );
}
