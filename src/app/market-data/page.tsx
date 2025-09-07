'use client';
import { useEffect, useRef, useState, DragEvent } from 'react';

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
  const streamsCleanup = useRef<null | (() => void)>(null);

  const connectAll = () => {
    // Close existing streams first
    streamsCleanup.current?.();
    setLoading(true);
    setError(null);

    const sortByTime = <T extends { timestamp: string }>(arr: T[]) =>
      [...arr].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const esList: EventSource[] = [];

    const connect = (url: string, onData: (data: any) => void) => {
      if (typeof window === 'undefined' || !('EventSource' in window)) {
        // Fallback fetch
        fetch(url.replace('&stream=1', ''))
          .then((r) => r.ok ? r.json() : Promise.reject(new Error(`Error: ${r.status}`)))
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

    connect('/api/get_camrilla?stream=1', (data) => {
      const arr = Array.isArray(data) ? sortByTime<Camarilla>(data) : [];
      setCamarillaData(arr);
    });
    connect('/api/get_hilo?stream=1', (data) => {
      const arr = Array.isArray(data) ? sortByTime<NDayHighLow>(data) : [];
      setBreakoutData(arr);
    });
    connect('/api/get_val?stream=1', (data) => {
      const arr = Array.isArray(data) ? sortByTime<Vals>(data) : [];
      setVolumeData(arr);
    });
    connect('/api/get_vwap?stream=1', (data) => {
      const arr = Array.isArray(data) ? sortByTime<VWAP>(data) : [];
      setVwapData(arr);
    });

    const cleanup = () => {
      esList.forEach((es) => es.close());
    };
    streamsCleanup.current = cleanup;
    return cleanup;
  };

  useEffect(() => {
  const cleanup = connectAll();
  return cleanup;
  }, []);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatPrice = (price: number | string | null | undefined) => {
    if (price === null || price === undefined) return '0.00';
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(numPrice)) return '0.00';
    return numPrice.toFixed(2);
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

  // Drag & drop state for the summary cards
  const [cardOrder, setCardOrder] = useState<string[]>(["camarilla", "highlow", "volume", "vwap"]);
  const dragSrcIndex = useRef<number | null>(null);

  const onDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    dragSrcIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', String(index)); } catch {}
    (e.currentTarget as HTMLElement).classList.add('opacity-70');
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // allow drop
    e.dataTransfer.dropEffect = 'move';
  };

  const onDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).classList.add('ring-2', 'ring-offset-2', 'ring-indigo-300');
  };

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).classList.remove('ring-2', 'ring-offset-2', 'ring-indigo-300');
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>, destIndex: number) => {
    e.preventDefault();
    const src = dragSrcIndex.current ?? parseInt(e.dataTransfer.getData('text/plain') || '0', 10);
    if (src === destIndex) {
      // cleanup visuals
      (e.currentTarget as HTMLElement).classList.remove('ring-2', 'ring-offset-2', 'ring-indigo-300');
      return;
    }
    setCardOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(src, 1);
      next.splice(destIndex, 0, moved);
      return next;
    });
    dragSrcIndex.current = null;
    (e.currentTarget as HTMLElement).classList.remove('ring-2', 'ring-offset-2', 'ring-indigo-300');
  };

  const onDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    // remove any visual state from all grid children
    const parent = (e.currentTarget as HTMLElement).parentElement;
    if (parent) {
      Array.from(parent.children).forEach((child) => child.classList.remove('opacity-70', 'ring-2', 'ring-offset-2', 'ring-indigo-300'));
    }
  };

  // Drag & drop for the main event data boxes
  const [eventOrder, setEventOrder] = useState<string[]>(["camarilla", "highlow", "volume", "vwap"]);
  const eventDragSrcIndex = useRef<number | null>(null);

  const onEventDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    eventDragSrcIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', String(index)); } catch {}
    (e.currentTarget as HTMLElement).classList.add('opacity-70');
  };

  const onEventDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onEventDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).classList.add('ring-2', 'ring-offset-2', 'ring-indigo-300');
  };

  const onEventDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).classList.remove('ring-2', 'ring-offset-2', 'ring-indigo-300');
  };

  const onEventDrop = (e: React.DragEvent<HTMLDivElement>, destIndex: number) => {
    e.preventDefault();
    const src = eventDragSrcIndex.current ?? parseInt(e.dataTransfer.getData('text/plain') || '0', 10);
    if (src === destIndex) {
      (e.currentTarget as HTMLElement).classList.remove('ring-2', 'ring-offset-2', 'ring-indigo-300');
      return;
    }
    setEventOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(src, 1);
      next.splice(destIndex, 0, moved);
      return next;
    });
    eventDragSrcIndex.current = null;
    (e.currentTarget as HTMLElement).classList.remove('ring-2', 'ring-offset-2', 'ring-indigo-300');
  };

  const onEventDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    const parent = (e.currentTarget as HTMLElement).parentElement;
    if (parent) {
      Array.from(parent.children).forEach((child) => child.classList.remove('opacity-70', 'ring-2', 'ring-offset-2', 'ring-indigo-300'));
    }
  };

  return (
    <main className="min-h-screen p-6" style={{ background: 'var(--background)' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-strong mb-2">📊 Market Data Dashboard</h1>
          <p className="text-muted">Real-time market events and trading signals</p>
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
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--accent)' }}></div>
              <p className="mt-2 text-muted">Loading market data...</p>
            </div>
        )}

        {/* Data Tables (draggable/reorderable) */}
        {!loading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {eventOrder.map((key, idx) => {
              const wrapperProps = {
                key: key,
                draggable: true,
                onDragStart: (e: React.DragEvent<HTMLDivElement>) => onEventDragStart(e, idx),
                onDragOver: onEventDragOver,
                onDragEnter: onEventDragEnter,
                onDragLeave: onEventDragLeave,
                onDrop: (e: React.DragEvent<HTMLDivElement>) => onEventDrop(e, idx),
                onDragEnd: onEventDragEnd,
                className: 'rounded-lg overflow-hidden bg-card border border-default cursor-move',
              } as any;

              if (key === 'camarilla') {
                return (
                  <div {...wrapperProps}>
                    <div className="px-6 py-4" style={{ background: '#7c3aed', color: 'white' }}>
                      <h2 className="text-xl font-semibold flex items-center">
                        🎯 Camarilla Events ({camarillaData.length})
                      </h2>
                    </div>
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full">
                        <thead className="table-head sticky top-0">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Symbol</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase">Camarilla</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-muted uppercase">Type</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-muted uppercase">Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ background: 'var(--card-bg)' }}>
                          {camarillaData.length > 0 ? camarillaData.map((item, index) => (
                            <tr key={index} className="hover-surface transition-colors">
                              <td className="px-4 py-3 text-sm font-medium text-strong">{item.symbol}</td>
                              <td className="px-4 py-3 text-sm text-strong text-right">₹{formatPrice(item.camarilla)}</td>
                              <td className="px-4 py-3 text-sm text-center">
                                <span className={`px-2 py-1 rounded-full text-xs ${getTypeBadgeColor(item.type)}`}>
                                  {item.type}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-muted text-center">
                                {formatTime(item.timestamp)}
                              </td>
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={4} className="px-4 py-8 text-center text-muted">
                                No Camarilla events available
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              }

              if (key === 'highlow') {
                return (
                  <div {...wrapperProps}>
                    <div className="px-6 py-4" style={{ background: '#f97316', color: 'white' }}>
                      <h2 className="text-xl font-semibold flex items-center">
                        📈 High/Low Events ({breakoutData.length})
                      </h2>
                    </div>
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full">
                        <thead className="table-head sticky top-0">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Symbol</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase">Value</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-muted uppercase">Type</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-muted uppercase">Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ background: 'var(--card-bg)' }}>
                          {breakoutData.length > 0 ? breakoutData.map((item, index) => (
                            <tr key={index} className="hover-surface transition-colors">
                              <td className="px-4 py-3 text-sm font-medium text-strong">{item.symbol}</td>
                              <td className="px-4 py-3 text-sm text-strong text-right">₹{formatPrice(item.value)}</td>
                              <td className="px-4 py-3 text-sm text-center">
                                <span className={`font-semibold ${getTypeColor(item.type)}`}>
                                  {item.type.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-muted text-center">
                                {formatTime(item.timestamp)}
                              </td>
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={4} className="px-4 py-8 text-center text-muted">
                                No high/low events available
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              }

              if (key === 'volume') {
                return (
                  <div {...wrapperProps}>
                    <div className="px-6 py-4" style={{ background: '#2563eb', color: 'white' }}>
                      <h2 className="text-xl font-semibold flex items-center">
                        📊 Volume Events ({volumeData.length})
                      </h2>
                    </div>
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full">
                        <thead className="table-head sticky top-0">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Symbol</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase">Value</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-muted uppercase">Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ background: 'var(--card-bg)' }}>
                          {volumeData.length > 0 ? volumeData.map((item, index) => (
                            <tr key={index} className="hover-surface transition-colors">
                              <td className="px-4 py-3 text-sm font-medium text-strong">{item.symbol}</td>
                              <td className="px-4 py-3 text-sm text-strong text-right">
                                {item.value?.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-sm text-muted text-center">
                                {formatTime(item.timestamp)}
                              </td>
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={3} className="px-4 py-8 text-center text-muted">
                                No volume events available
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              }

              // vwap
              return (
                <div {...wrapperProps}>
                  <div className="px-6 py-4" style={{ background: '#16a34a', color: 'white' }}>
                    <h2 className="text-xl font-semibold flex items-center">
                      📈 VWAP Events ({vwapData.length})
                    </h2>
                  </div>
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full">
                      <thead className="table-head sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Symbol</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase">VWAP</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-muted uppercase">Type</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-muted uppercase">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ background: 'var(--card-bg)' }}>
                        {vwapData.length > 0 ? vwapData.map((item, index) => (
                          <tr key={index} className="hover-surface transition-colors">
                            <td className="px-4 py-3 text-sm font-medium text-strong">{item.symbol}</td>
                            <td className="px-4 py-3 text-sm text-strong text-right">₹{item.vwap?.toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm text-center">
                              <span className={`px-2 py-1 rounded-full text-xs ${getTypeBadgeColor(item.type)}`}>
                                {item.type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-muted text-center">
                              {formatTime(item.timestamp)}
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-muted">
                              No VWAP events available
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Summary Cards (draggable/reorderable) */}
        {!loading && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
            {cardOrder.map((key, idx) => {
              const commonProps = {
                key: key,
                draggable: true,
                onDragStart: (e: React.DragEvent<HTMLDivElement>) => onDragStart(e, idx),
                onDragOver: onDragOver,
                onDragEnter: onDragEnter,
                onDragLeave: onDragLeave,
                onDrop: (e: React.DragEvent<HTMLDivElement>) => onDrop(e, idx),
                onDragEnd: onDragEnd,
                className: 'rounded-lg p-4 bg-card border border-default cursor-move',
                style: { minHeight: 80 },
              } as any;

              if (key === 'camarilla') {
                return (
                  <div {...commonProps}>
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <span className="text-2xl">🎯</span>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-strong">Camarilla</h3>
                        <p className="text-xl font-bold" style={{ color: '#7c3aed' }}>{camarillaData.length}</p>
                      </div>
                    </div>
                  </div>
                );
              }

              if (key === 'highlow') {
                return (
                  <div {...commonProps}>
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <span className="text-2xl">📈</span>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-strong">High/Low</h3>
                        <p className="text-xl font-bold" style={{ color: '#f97316' }}>{breakoutData.length}</p>
                      </div>
                    </div>
                  </div>
                );
              }

              if (key === 'volume') {
                return (
                  <div {...commonProps}>
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <span className="text-2xl">📊</span>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-strong">Volume</h3>
                        <p className="text-xl font-bold" style={{ color: '#2563eb' }}>{volumeData.length}</p>
                      </div>
                    </div>
                  </div>
                );
              }

              // vwap
              return (
                <div {...commonProps}>
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <span className="text-2xl">📈</span>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-strong">VWAP</h3>
                      <p className="text-xl font-bold" style={{ color: '#16a34a' }}>{vwapData.length}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
