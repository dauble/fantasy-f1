import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StatBarChart from '../components/ui/StatBarChart';
import { getTeamColor } from '../utils/teamColors';
import { formatLocalDateTime } from '../utils/formatDate';

// Which stat fields to offer per tab, and how to format each one. Sourced
// from data/price_snapshots.json (see scripts/lib/fantasyPriceFeed.mjs) —
// the same cache the "Sync Official Prices" button refreshes.
const DRIVER_METRICS = [
  { key: 'points', label: 'Season Points', format: (v) => v.toFixed(0) },
  { key: 'avgPoints', label: 'Avg Points / Race', format: (v) => v.toFixed(1) },
  { key: 'pointsPerMillion', label: 'Value (pts / $M)', format: (v) => v.toFixed(2) },
  { key: 'podiums', label: 'Podiums', format: (v) => v.toFixed(0) },
  { key: 'topTenFinishes', label: 'Top 10 Finishes', format: (v) => v.toFixed(0) },
  { key: 'overtakePoints', label: 'Overtake Points', format: (v) => v.toFixed(0) },
  { key: 'fastestLaps', label: 'Fastest Laps', format: (v) => v.toFixed(0) },
  { key: 'driverOfDayCount', label: 'Driver of the Day', format: (v) => v.toFixed(0) },
  { key: 'dnfs', label: 'DNFs', format: (v) => v.toFixed(0) },
  { key: 'selectionPct', label: 'Selected By (%)', format: (v) => `${v.toFixed(0)}%` },
  { key: 'seasonPriceChangeM', label: 'Season Price Change', format: (v) => `${v >= 0 ? '+' : ''}$${v.toFixed(1)}M` },
];

const CONSTRUCTOR_METRICS = [
  { key: 'points', label: 'Season Points', format: (v) => v.toFixed(0) },
  { key: 'avgPoints', label: 'Avg Points / Race', format: (v) => v.toFixed(1) },
  { key: 'pointsPerMillion', label: 'Value (pts / $M)', format: (v) => v.toFixed(2) },
  { key: 'podiums', label: 'Podiums', format: (v) => v.toFixed(0) },
  { key: 'topTenFinishes', label: 'Top 10 Finishes', format: (v) => v.toFixed(0) },
  { key: 'overtakePoints', label: 'Overtake Points', format: (v) => v.toFixed(0) },
  { key: 'fastestLaps', label: 'Fastest Laps', format: (v) => v.toFixed(0) },
  { key: 'fastestPitstops', label: 'Fastest Pitstops', format: (v) => v.toFixed(0) },
  { key: 'dnfs', label: 'DNFs', format: (v) => v.toFixed(0) },
  { key: 'selectionPct', label: 'Selected By (%)', format: (v) => `${v.toFixed(0)}%` },
  { key: 'seasonPriceChangeM', label: 'Season Price Change', format: (v) => `${v >= 0 ? '+' : ''}$${v.toFixed(1)}M` },
];

const TABLE_COLUMNS = [
  { key: 'priceM', label: 'Price', format: (v) => `$${v.toFixed(1)}M` },
  { key: 'points', label: 'Pts', format: (v) => v.toFixed(0) },
  { key: 'avgPoints', label: 'Avg', format: (v) => v?.toFixed(1) ?? '—' },
  { key: 'pointsPerMillion', label: 'Pts/$M', format: (v) => v?.toFixed(2) ?? '—' },
  { key: 'podiums', label: 'Podiums', format: (v) => v ?? '—' },
  { key: 'overtakePoints', label: 'Overtakes', format: (v) => v ?? '—' },
  { key: 'dnfs', label: 'DNFs', format: (v) => v ?? '—' },
  { key: 'selectionPct', label: 'Picked', format: (v) => (v != null ? `${v}%` : '—') },
];

const FantasyStats = () => {
  const [latest, setLatest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('drivers');
  const [metric, setMetric] = useState('points');

  useEffect(() => {
    fetch('/api/fantasy-prices')
      .then((res) => res.json())
      .then((body) => setLatest(body.latest))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Reset to a metric that exists on the newly active tab (avgPoints exists on
  // both, but fastestPitstops/driverOfDayCount are tab-specific)
  const metrics = activeTab === 'drivers' ? DRIVER_METRICS : CONSTRUCTOR_METRICS;
  useEffect(() => {
    if (!metrics.some((m) => m.key === metric)) setMetric('points');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  if (loading) {
    return (
      <div className="px-4 py-6">
        <h1 className="text-2xl font-black uppercase tracking-tight text-gray-900 dark:text-white mb-4">Fantasy Stats</h1>
        <p className="text-gray-500 dark:text-f1-muted">Loading…</p>
      </div>
    );
  }

  if (error || !latest) {
    return (
      <div className="px-4 py-6">
        <h1 className="text-2xl font-black uppercase tracking-tight text-gray-900 dark:text-white mb-4">Fantasy Stats</h1>
        <div className="px-4 py-3 rounded-xl text-sm font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
          {error || 'No price snapshot available yet.'} Visit{' '}
          <Link to="/prices" className="underline">Price Manager</Link> and click "Sync Official Prices" to fetch one.
        </div>
      </div>
    );
  }

  const rows = activeTab === 'drivers' ? latest.drivers : latest.constructors;
  const activeMetric = metrics.find((m) => m.key === metric);

  const chartData = rows
    .filter((r) => typeof r[metric] === 'number')
    .sort((a, b) => b[metric] - a[metric])
    .map((r) => ({
      label: r.name || r.team,
      sublabel: r.name ? `${r.name} (${r.team})` : r.team,
      value: r[metric],
      color: getTeamColor(r.team),
    }));

  return (
    <div className="px-4 py-5">
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-6 bg-f1-red rounded-full" />
          <h1 className="text-2xl font-black uppercase tracking-tight text-gray-900 dark:text-white">Fantasy Stats</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-f1-muted">
          Official F1 Fantasy season stats, synced {formatLocalDateTime(latest.fetchedAt)} —{' '}
          <Link to="/prices" className="underline">sync again</Link> for the latest numbers.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-f1-surface p-1 rounded-xl max-w-xs">
        {[
          { id: 'drivers', label: `Drivers (${latest.drivers.length})` },
          { id: 'constructors', label: `Constructors (${latest.constructors.length})` },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wide transition-all ${
              activeTab === id
                ? 'bg-white dark:bg-f1-elevated text-f1-red shadow-sm'
                : 'text-gray-500 dark:text-f1-muted hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Metric selector */}
      <div className="mb-4">
        <label className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-f1-muted block mb-1.5">
          Chart by
        </label>
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
          className="px-3 py-2 text-sm font-semibold bg-white dark:bg-f1-surface border border-gray-200 dark:border-f1-border rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-f1-red"
        >
          {metrics.map((m) => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Chart */}
      <div className="mb-6 p-4 rounded-xl bg-white dark:bg-f1-surface border border-gray-200 dark:border-f1-border">
        <StatBarChart data={chartData} formatValue={activeMetric.format} />
      </div>

      {/* Full data table — every stat, for the reader who wants exact numbers */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-f1-border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-f1-elevated">
            <tr>
              <th className="text-left px-3 py-2 font-bold uppercase text-xs text-gray-500 dark:text-f1-muted">
                {activeTab === 'drivers' ? 'Driver' : 'Constructor'}
              </th>
              {TABLE_COLUMNS.map((col) => (
                <th key={col.key} className="text-right px-3 py-2 font-bold uppercase text-xs text-gray-500 dark:text-f1-muted tabular-nums">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...rows].sort((a, b) => (b.points ?? 0) - (a.points ?? 0)).map((r) => (
              <tr key={r.playerId} className="border-t border-gray-100 dark:border-f1-border">
                <td className="px-3 py-2 font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                  {r.name || r.team}
                  {r.name && <span className="text-gray-500 dark:text-f1-muted font-normal"> · {r.team}</span>}
                </td>
                {TABLE_COLUMNS.map((col) => (
                  <td key={col.key} className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-f1-muted">
                    {col.format(r[col.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FantasyStats;
