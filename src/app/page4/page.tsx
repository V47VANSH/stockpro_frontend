"use client";
import React, { useEffect, useMemo, useState } from 'react';

const Page4 = () => {
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [search] = useState('');
  const [prefix] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<string | null>(null);

  const loadSheets = async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      if (prefix) params.append('prefix', prefix);
      if (search) params.append('q', search);
      const res = await fetch(`/api/list_sheets${params.toString() ? `?${params.toString()}` : ''}`);
      if (!res.ok) throw new Error('Failed to fetch sheets');
      const data = await res.json();
      setSheets(Array.isArray(data.sheets) ? data.sheets : []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error loading sheets';
      setError(msg);
    }
  };

  useEffect(() => {
    loadSheets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canDownload = useMemo(() => !!selectedSheet, [selectedSheet]);

  const handleDownload = () => {
    if (!selectedSheet) return;
    const params = new URLSearchParams();
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    
    const url = `/api/download_sheet?sheet=${encodeURIComponent(selectedSheet)}${
      params.toString() ? `&${params.toString()}` : ''
    }`;
    // Use same tab for better UX on mobile; fallback to window.location
    const w = window.open(url, '_blank');
    if (!w) window.location.href = url;
  };

  const handleRefreshAllData = async () => {
    try {
      setRefreshing(true);
      setRefreshResult(null);
      setError(null);
      
      const res = await fetch('/api/refresh_all_data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!res.ok) {
        throw new Error('Failed to refresh data');
      }
      
      const data = await res.json();
      setRefreshResult(data.message);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error refreshing data';
      setError(msg);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6" style={{ background: 'var(--background)' }}>
      <h2 className="text-2xl font-semibold mb-4 text-strong">Download Excel Sheets</h2>
      
      <div className="mb-6 p-4 rounded-lg border border-default" style={{ background: 'var(--card-bg)' }}>
        <h3 className="text-lg font-medium mb-2 text-strong">Data Management</h3>
        <p className="text-sm text-muted mb-2">
          Use the <strong>Refresh All Data</strong> button to force refresh all market data and signals from PostgreSQL database. 
          This will update Redis cache for all endpoints including breakout events, VWAP events, Camarilla events, volume events, and active signals.
        </p>
        <p className="text-xs text-muted">
          This is useful when Redis data is stale or when you want to ensure you have the latest data from the database.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="col-span-1 md:col-span-2 flex gap-2">
          
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 text-red-800 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {refreshResult && (
        <div className="mb-4 rounded border border-green-300 bg-green-50 text-green-800 px-3 py-2 text-sm">
          {refreshResult}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-lg p-4 border border-default" style={{ background: 'var(--card-bg)' }}>
          <label className="block text-sm mb-2">Sheet</label>
          <select
            className="w-full rounded border border-gray-300 bg-transparent px-3 py-2"
            value={selectedSheet}
            onChange={(e) => setSelectedSheet(e.target.value)}
          >
            <option value="">Select a sheet</option>
            {sheets.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-muted">Showing {sheets.length} table(s).</p>
        </div>
        <div className="rounded-lg p-4 border border-default" style={{ background: 'var(--card-bg)' }}>
          <label className="block text-sm mb-2">Date Range (Optional)</label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="flex-1 rounded border border-gray-300 bg-transparent px-3 py-2"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              placeholder="Start date"
            />
            <span className="text-sm text-gray-500">to</span>
            <input
              type="date"
              className="flex-1 rounded border border-gray-300 bg-transparent px-3 py-2"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              placeholder="End date"
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            Leave empty to download all data. All symbols will be included.
          </p>
        </div>
      </div>

      <div className="mt-6 flex gap-3 flex-wrap">
        <button
          onClick={handleDownload}
          disabled={!canDownload}
          className="rounded px-4 py-2 disabled:opacity-50"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          title={!canDownload ? 'Select a sheet first' : 'Download as .xlsx with all symbols'}
        >
          Download XLSX (All Symbols)
        </button>
        <button
          onClick={handleRefreshAllData}
          disabled={refreshing}
          className="rounded px-4 py-2 disabled:opacity-50"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          title="Refresh all market data and signals from PostgreSQL"
        >
          {refreshing ? 'Refreshing...' : 'Refresh All Data'}
        </button>
        <button
          onClick={() => {
            setSelectedSheet('');
            setStart('');
            setEnd('');
            setRefreshResult(null);
            setError(null);
          }}
          className="rounded px-4 py-2 border border-default"
          style={{ background: 'transparent' }}
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default Page4;
