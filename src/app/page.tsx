'use client';
import { useEffect, useState } from 'react';
import AdvanceDeclineChart from '../components/AdvanceDeclineChart';

interface StockMover {
  name: string;
  value: number;
}

interface MoversData {
  pullers: [string, number][];
  draggers: [string, number][];
}

const indices = [
  { id: 'nifty50', name: 'NIFTY 50', icon: '📈' },
  { id: 'banknifty', name: 'BANK NIFTY', icon: '💰' },
  { id: 'niftymidcap', name: 'NIFTY MIDCAP SELECT', icon: '📉' },
  { id: 'sensex', name: 'SENSEX', icon: '📊' },
  { id: 'bankex', name: 'BANKEX', icon: '🏦' }
];

export default function Page() {
  const [data, setData] = useState<MoversData | null>(null);
  const [selectedIndex, setSelectedIndex] = useState('sensex');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectSSE = (index: string) => {
    setLoading(true);
    setError(null);
    try {
      if (typeof window === 'undefined' || !('EventSource' in window)) {
        fetch(`/api/get_mover?index=${index}`)
          .then(async (r) => {
            if (!r.ok) throw new Error(`Error: ${r.status}`);
            return r.json();
          })
          .then((json) => setData(json))
          .catch((e) => {
            setError(e instanceof Error ? e.message : 'Failed to fetch data');
            setData(null);
          })
          .finally(() => setLoading(false));
        return () => {};
      }

      const es = new EventSource(`/api/get_mover?index=${index}&stream=1`);
      const onUpdate = (ev: MessageEvent) => {
        try {
          const payload = JSON.parse(ev.data);
          setData(payload);
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

      return () => {
        es.close();
      };
    } catch (err) {
      setError('Failed to connect');
      setLoading(false);
      return () => {};
    }
  };

  useEffect(() => {
    const cleanup = connectSSE(selectedIndex);
    return cleanup;
  }, [selectedIndex]);

  const formatValue = (value: number) => {
    const formatted = Math.abs(value).toFixed(2);
    const sign = value >= 0 ? '+' : '-';
    return `${sign}${formatted}`;
  };

  const getColorClass = (value: number) => {
    return value >= 0 ? 'text-green-600' : 'text-red-600';
  };

  return (
    <main className="p-6 min-h-[calc(100vh-4rem)]" style={{ background: 'var(--background)' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-strong mb-2">📈 Stock Movers Dashboard</h1>
          <p className="text-muted">Real-time stock market movers across major indices</p>
        </div>

        {/* Index Selector */}
        <div className="flex justify-center mb-8">
          <div className="rounded-lg shadow-card p-2 flex space-x-2 bg-card border border-default">
            {indices.map((index) => (
              <button
                key={index.id}
                onClick={() => setSelectedIndex(index.id)}
                className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 ${
                  selectedIndex === index.id
                    ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-lg'
                    : 'text-muted hover-surface'
                }`}
              >
                <span>{index.icon}</span>
                <span>{index.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--accent)' }}></div>
            <p className="mt-2 text-muted">Loading data...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-lg p-4 mb-6" style={{ background: 'var(--card-bg)', border: '1px solid rgba(220,38,38,0.12)' }}>
            <p className="text-red-600 text-center">⚠️ {error}</p>
          </div>
        )}

        {/* Advance Decline Chart - Above Data Tables */}
        <div className="mt-8">
          <AdvanceDeclineChart selectedIndex={selectedIndex} />
        </div>

        {/* Data Display */}
        {data && !loading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pullers Table */}
            <div className="rounded-lg overflow-hidden bg-card border border-default">
                <div className="px-6 py-4" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
                  <h2 className="text-xl font-semibold flex items-center">
                    🔼 Top Gainers ({data.pullers.length})
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="table-head">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                        Rank
                      </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                        Stock
                      </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                        Points
                      </th>
                    </tr>
                  </thead>
                    <tbody className="divide-y" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-default)' }}>
                    {data.pullers.map(([name, value], index) => (
                        <tr key={name} className="hover-surface transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                            #{index + 1}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-strong">
                            {name}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold text-right ${getColorClass(value)}`}>
                            {formatValue(value)}
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Draggers Table */}
            <div className="rounded-lg overflow-hidden bg-card border border-default">
              <div className="px-6 py-4" style={{ background: '#dc2626', color: 'white' }}>
                <h2 className="text-xl font-semibold flex items-center">
                  🔽 Top Losers ({data.draggers.length})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="table-head">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                        Rank
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                        Stock
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                        Points
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-default)' }}>
                    {data.draggers.map(([name, value], index) => (
                      <tr key={name} className="hover-surface transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                          #{index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-strong">
                          {name}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold text-right ${getColorClass(value)}`}>
                          {formatValue(value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!data && !loading && !error && (
          <div className="text-center py-12">
            <p className="text-muted">Select an index to view stock movers</p>
          </div>
        )}
      </div>
    </main>
  );
}
