'use client';
import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface AdvanceDeclinePoint {
  timestamp: string;
  pullers: number;
  draggers: number;
}

interface AdvanceDeclineData {
  sensex: AdvanceDeclinePoint[];
  nifty: AdvanceDeclinePoint[];
  banknifty: AdvanceDeclinePoint[];
  midcap: AdvanceDeclinePoint[];
  smallcap: AdvanceDeclinePoint[];
}

const indexConfig = [
  { key: 'sensex', name: 'SENSEX', color: '#3B82F6', icon: '📊' },
  { key: 'nifty', name: 'NIFTY 50', color: '#10B981', icon: '📈' },
  { key: 'banknifty', name: 'BANK NIFTY', color: '#F59E0B', icon: '💰' },
  { key: 'midcap', name: 'MIDCAP', color: '#8B5CF6', icon: '📉' },
  { key: 'smallcap', name: 'BANKEX', color: '#EF4444', icon: '🏦' }
];

// Map frontend index names to our chart data keys
const indexMapping: Record<string, string> = {
  'sensex': 'sensex',
  'nifty50': 'nifty',
  'banknifty': 'banknifty',
  'niftymidcap': 'midcap',
  'bankex': 'smallcap'
};

interface AdvanceDeclineChartProps {
  selectedIndex: string;
}

export default function AdvanceDeclineChart({ selectedIndex }: AdvanceDeclineChartProps) {
  const [data, setData] = useState<AdvanceDeclineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/get_advance_decline');
        if (response.ok) {
          const result = await response.json();
          setData(result);
        } else {
          // Any HTTP error - just show no data
          console.error('API error:', response.status, response.statusText);
          setData(null);
        }
      } catch (err) {
        // Any fetch error - just show no data
        console.error('Fetch error:', err);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Set up polling to refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [selectedIndex]); // Re-fetch when selectedIndex changes

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const customTooltip = (props: { active?: boolean; payload?: unknown; label?: unknown }) => {
    const { active, payload, label } = props;
    if (active && Array.isArray(payload) && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900">{`Time: ${formatTime(String(label))}`}</p>
          {payload.map((entry: unknown, index: number) => {
            const typedEntry = entry as { dataKey: string; value: number; color: string };
            return (
              <p key={index} className="text-sm" style={{ color: typedEntry.color }}>
                {`${typedEntry.dataKey === 'pullers' ? 'Pullers' : 'Draggers'}: ${typedEntry.value}`}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  if (loading) {
      return (
        <div className="rounded-lg p-6 bg-card border border-default shadow-card">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      );
  }

  if (!data && !loading) {
    const mappedIndex = indexMapping[selectedIndex] || selectedIndex;
    const currentIndexConfig = indexConfig.find(config => config.key === mappedIndex);
    const indexName = currentIndexConfig?.name || selectedIndex.toUpperCase();
    
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            📊 Advance/Decline Chart - {indexName}
          </h2>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-lg font-medium text-gray-600 mb-2">No Chart Data Available</h3>
            <p className="text-gray-500">Advance/decline data for {indexName} will appear here when available</p>
          </div>
        </div>
      </div>
    );
  }

  // Prepare data for single index chart
  const prepareChartData = () => {
    if (!data) return [];
    
    const mappedIndex = indexMapping[selectedIndex] || selectedIndex;
    const indexData = data[mappedIndex as keyof AdvanceDeclineData];
    
    if (!indexData || indexData.length === 0) return [];
    // We expect incoming data to be newest-first (indexData[0] is most recent).
    // Keep only the most recent 375 points if there are more, otherwise use all available.
    const MAX_POINTS = 375;
    const recentSlice = indexData.length > MAX_POINTS ? indexData.slice(0, MAX_POINTS) : indexData.slice(0);

    // Map and reverse so chart data is chronological (old -> new)
    return recentSlice.map(point => ({
      timestamp: point.timestamp,
      pullers: point.pullers,
      draggers: point.draggers
    })).reverse();
  };

  const chartData = prepareChartData();
  // Choose tick interval dynamically so ticks are not overcrowded for many points.
  // Aim for ~8-10 ticks visible depending on data length.
  const calculateTickInterval = (len: number) => {
    if (len <= 10) return 0; // show all ticks
    const targetTicks = 9;
    return Math.max(1, Math.floor(len / targetTicks));
  };
  const tickInterval = calculateTickInterval(chartData.length);
  const mappedIndex = indexMapping[selectedIndex] || selectedIndex;
  const currentIndexConfig = indexConfig.find(config => config.key === mappedIndex);
  const indexName = currentIndexConfig?.name || selectedIndex.toUpperCase();
  const indexColor = currentIndexConfig?.color || '#3B82F6';

    return (
      <div className="rounded-lg p-6 bg-card border border-default shadow-card">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-strong flex items-center">
            📊 Advance/Decline Chart - {indexName}
          </h2>
          
          <div className="flex space-x-2">
            <button
              onClick={() => setChartType(chartType === 'line' ? 'bar' : 'line')}
              className="px-3 py-1 rounded-md text-sm"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
            >
              {chartType === 'line' ? '📊 Bar' : '📈 Line'}
            </button>
          </div>
        </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'line' ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={formatTime}
                tick={{ fontSize: 12 }}
                interval={tickInterval}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip content={customTooltip} />
              <Legend />
              
                <>
                  <Line
                    type="monotone"
                    dataKey="pullers"
                    stroke="#10B981"
                    strokeWidth={2}
                    name="Pullers"
                    connectNulls={false}
                    dot={{ r: 0 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="draggers"
                    stroke="#EF4444"
                    strokeWidth={2}
                    name="Draggers"
                    connectNulls={false}
                    dot={{ r: 0 }}
                  />
                </>
            </LineChart>
          ) : (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={formatTime}
                tick={{ fontSize: 12 }}
                interval={tickInterval}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip content={customTooltip} />
              <Legend />
              
                <>
                  <Bar
                    dataKey="pullers"
                    fill="#10B981"
                    name="Pullers"
                  />
                  <Bar
                    dataKey="draggers"
                    fill="#EF4444"
                    name="Draggers"
                  />
                </>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Summary Card for Selected Index */}
      
    </div>
  );
}
