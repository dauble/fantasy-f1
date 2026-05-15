import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import priceStorage from '../utils/priceStorage';
import setupStorage from '../utils/setupStorage';
import { DRIVER_PRICES, CONSTRUCTOR_PRICES, getDriverPrice, getConstructorPrice } from '../utils/pricing';
import openF1API from '../services/openF1API';
import { useAuth } from '../context/AuthContext';
import { getDriverColor, getTeamColor } from '../utils/teamColors';

const PriceManager = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isSetupMode = searchParams.get('setup') === 'true';
  const { syncToCloud } = useAuth();

  const [drivers, setDrivers] = useState([]);
  const [constructors, setConstructors] = useState([]);
  const [customPrices, setCustomPrices] = useState({ drivers: {}, constructors: {} });
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('');
  const [activeTab, setActiveTab] = useState('drivers');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const driversData = await openF1API.getDrivers();
      const uniqueDrivers = Array.from(
        new Map(driversData.map(d => [d.driver_number, d])).values()
      );
      const sortedDrivers = uniqueDrivers.sort((a, b) =>
        getDriverPrice(b.driver_number) - getDriverPrice(a.driver_number)
      );
      setDrivers(sortedDrivers);

      const uniqueConstructors = Array.from(new Set(uniqueDrivers.map(d => d.team_name)))
        .sort((a, b) => getConstructorPrice(b) - getConstructorPrice(a));
      setConstructors(uniqueConstructors);

      const saved = priceStorage.getCustomPrices();
      if (saved) {
        setCustomPrices({ drivers: saved.drivers || {}, constructors: saved.constructors || {} });
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const handleDriverPriceChange = (driverNumber, value) => {
    const price = parseFloat(value) * 1_000_000;
    if (isNaN(price) || price < 0) return;
    setCustomPrices(prev => ({
      ...prev,
      drivers: { ...prev.drivers, [driverNumber]: price }
    }));
  };

  const handleConstructorPriceChange = (teamName, value) => {
    const price = parseFloat(value) * 1_000_000;
    if (isNaN(price) || price < 0) return;
    setCustomPrices(prev => ({
      ...prev,
      constructors: { ...prev.constructors, [teamName]: price }
    }));
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    const success = priceStorage.saveCustomPrices(customPrices);
    if (success) {
      await syncToCloud();
      setSaveStatus('saved');
      if (isSetupMode) {
        setupStorage.markSetupComplete();
        setTimeout(() => navigate('/'), 1500);
      } else {
        setTimeout(() => setSaveStatus(''), 3000);
      }
    } else {
      setSaveStatus('error');
    }
  };

  const handleResetToDefaults = async () => {
    if (window.confirm('Reset all prices to defaults? This will clear your custom prices.')) {
      priceStorage.clearCustomPrices();
      setCustomPrices({ drivers: {}, constructors: {} });
      await syncToCloud();
      setSaveStatus('reset');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const handleExport = () => {
    const success = priceStorage.exportPricesCSV(customPrices);
    if (!success) alert('Failed to export prices. Please try again.');
  };

  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const imported = await priceStorage.importPricesCSV(file);
      setCustomPrices(imported);
      alert('Prices imported! Click "Save Changes" to apply.');
    } catch {
      alert('Failed to import prices. Please check the file format.');
    }
    event.target.value = '';
  };

  const getCurrentPrice = (type, identifier) => {
    if (type === 'driver') return customPrices.drivers[identifier] || DRIVER_PRICES[identifier] || 8_000_000;
    return customPrices.constructors[identifier] || CONSTRUCTOR_PRICES[identifier] || 10_000_000;
  };

  const hasCustomPrice = (type, identifier) => {
    if (type === 'driver') return customPrices.drivers[identifier] !== undefined;
    return customPrices.constructors[identifier] !== undefined;
  };

  const getPriceChange = (type, identifier) => {
    if (type === 'driver') return priceStorage.getDriverPriceChange(identifier);
    return priceStorage.getConstructorPriceChange(identifier);
  };

  if (loading) {
    return (
      <div className="px-4 py-6">
        <h1 className="text-2xl font-black uppercase tracking-tight text-gray-900 dark:text-white mb-4">Price Manager</h1>
        <p className="text-gray-500 dark:text-f1-muted">Loading drivers…</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-5">
      {/* Setup mode banner */}
      {isSetupMode && (
        <div className="mb-5 rounded-xl bg-gradient-to-r from-f1-red to-f1-red-dark p-5 text-white shadow-lg shadow-f1-red/20">
          <h2 className="text-xl font-black uppercase tracking-tight mb-1">Initial Setup</h2>
          <p className="text-sm text-white/80">
            Enter current prices from the official Fantasy F1 site, then tap Save.
          </p>
        </div>
      )}

      {/* Page header */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-6 bg-f1-red rounded-full" />
          <h1 className="text-2xl font-black uppercase tracking-tight text-gray-900 dark:text-white">
            {isSetupMode ? 'Set Your Prices' : 'Price Manager'}
          </h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-f1-muted">
          {isSetupMode
            ? 'Visit fantasy.formula1.com to get current prices'
            : 'Update weekly to match the official Fantasy F1 site'
          }
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className="px-5 py-2.5 bg-f1-red hover:bg-f1-red-dark text-white rounded-xl font-bold uppercase tracking-wide transition-colors disabled:opacity-50 text-sm min-h-touch"
        >
          {saveStatus === 'saving' ? 'Saving…' : isSetupMode ? 'Save & Continue' : 'Save Changes'}
        </button>
        {!isSetupMode && (
          <>
            <button
              onClick={handleResetToDefaults}
              className="px-4 py-2.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-white rounded-xl font-bold uppercase tracking-wide text-sm transition-colors min-h-touch"
            >
              Reset
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-2.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-white rounded-xl font-bold uppercase tracking-wide text-sm transition-colors min-h-touch"
            >
              Export CSV
            </button>
            <label className="px-4 py-2.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-white rounded-xl font-bold uppercase tracking-wide text-sm cursor-pointer transition-colors min-h-touch flex items-center">
              Import CSV
              <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
            </label>
          </>
        )}
        {isSetupMode && (
          <button
            onClick={() => { setupStorage.markSetupComplete(); navigate('/'); }}
            className="px-4 py-2.5 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white rounded-xl font-bold uppercase tracking-wide text-sm transition-colors min-h-touch"
          >
            Skip
          </button>
        )}
      </div>

      {/* Save status */}
      {saveStatus && saveStatus !== 'saving' && (
        <div className={`mb-5 px-4 py-3 rounded-xl text-sm font-semibold ${
          saveStatus === 'saved' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300' :
          saveStatus === 'reset' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300' :
          'bg-red-100 dark:bg-red-900/30 text-f1-red dark:text-red-400'
        }`}>
          {saveStatus === 'saved' && (isSetupMode ? 'Prices saved! Redirecting…' : 'Prices saved successfully.')}
          {saveStatus === 'reset' && 'Prices reset to defaults.'}
          {saveStatus === 'error' && 'Failed to save prices. Please try again.'}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 dark:bg-f1-surface p-1 rounded-xl">
        {[
          { id: 'drivers', label: `Drivers (${drivers.length})` },
          { id: 'constructors', label: `Constructors (${constructors.length})` },
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

      {/* Drivers tab */}
      {activeTab === 'drivers' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {drivers.map(driver => {
            const currentPrice = getCurrentPrice('driver', driver.driver_number);
            const isCustom = hasCustomPrice('driver', driver.driver_number);
            const priceChange = getPriceChange('driver', driver.driver_number);
            const teamColor = getDriverColor(driver.team_name);
            const name = driver.full_name || `${driver.first_name} ${driver.last_name}`;

            return (
              <div
                key={driver.driver_number}
                style={{ borderLeftColor: teamColor, borderLeftWidth: '4px' }}
                className="flex items-center gap-4 px-4 py-4 rounded-xl bg-white dark:bg-f1-surface border border-gray-200 dark:border-f1-border"
              >
                {/* Driver number badge */}
                <div
                  className="w-11 h-11 rounded-lg flex items-center justify-center text-white font-black text-sm flex-shrink-0"
                  style={{ backgroundColor: teamColor }}
                >
                  {driver.driver_number}
                </div>

                {/* Driver info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-black text-base text-gray-900 dark:text-white uppercase tracking-wide truncate">
                      {name}
                    </p>
                    {isCustom && (
                      <span className="text-[9px] bg-f1-red text-white px-1 py-0.5 rounded font-black uppercase flex-shrink-0">
                        Custom
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-f1-muted truncate">{driver.team_name}</p>
                </div>

                {/* Price change indicator */}
                {priceChange && (
                  <div className={`text-right flex-shrink-0 text-sm font-bold ${
                    priceChange.direction === 'up' ? 'text-emerald-600 dark:text-emerald-400' :
                    priceChange.direction === 'down' ? 'text-f1-red' : 'text-gray-500'
                  }`}>
                    {priceChange.direction === 'up' ? '▲' : priceChange.direction === 'down' ? '▼' : ''}
                    {priceChange.percentChange}%
                  </div>
                )}

                {/* Price input */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-sm font-bold text-gray-500 dark:text-f1-muted">$</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="50"
                    value={(currentPrice / 1_000_000).toFixed(1)}
                    onChange={(e) => handleDriverPriceChange(driver.driver_number, e.target.value)}
                    className="w-16 px-2 py-2 text-base font-bold text-center bg-gray-50 dark:bg-f1-elevated border border-gray-200 dark:border-f1-border rounded-lg focus:outline-none focus:ring-2 focus:ring-f1-red text-gray-900 dark:text-white"
                  />
                  <span className="text-sm font-bold text-gray-500 dark:text-f1-muted">M</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Constructors tab */}
      {activeTab === 'constructors' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {constructors.map(teamName => {
            const currentPrice = getCurrentPrice('constructor', teamName);
            const isCustom = hasCustomPrice('constructor', teamName);
            const priceChange = getPriceChange('constructor', teamName);
            const teamColor = getTeamColor(teamName);

            return (
              <div
                key={teamName}
                className="flex items-center gap-4 px-4 py-4 rounded-xl bg-white dark:bg-f1-surface border border-gray-200 dark:border-f1-border overflow-hidden relative"
              >
                <div
                  className="absolute top-0 left-0 right-0 h-0.5"
                  style={{ backgroundColor: teamColor }}
                />

                {/* Team color swatch */}
                <div
                  className="w-11 h-11 rounded-lg flex-shrink-0"
                  style={{ backgroundColor: teamColor }}
                />

                {/* Team info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-black text-base text-gray-900 dark:text-white uppercase tracking-wide truncate">
                      {teamName}
                    </p>
                    {isCustom && (
                      <span className="text-[9px] bg-f1-red text-white px-1 py-0.5 rounded font-black uppercase flex-shrink-0">
                        Custom
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-f1-muted">Constructor</p>
                </div>

                {/* Price change */}
                {priceChange && (
                  <div className={`text-right flex-shrink-0 text-sm font-bold ${
                    priceChange.direction === 'up' ? 'text-emerald-600 dark:text-emerald-400' :
                    priceChange.direction === 'down' ? 'text-f1-red' : 'text-gray-500'
                  }`}>
                    {priceChange.direction === 'up' ? '▲' : priceChange.direction === 'down' ? '▼' : ''}
                    {priceChange.percentChange}%
                  </div>
                )}

                {/* Price input */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-sm font-bold text-gray-500 dark:text-f1-muted">$</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="50"
                    value={(currentPrice / 1_000_000).toFixed(1)}
                    onChange={(e) => handleConstructorPriceChange(teamName, e.target.value)}
                    className="w-16 px-2 py-2 text-base font-bold text-center bg-gray-50 dark:bg-f1-elevated border border-gray-200 dark:border-f1-border rounded-lg focus:outline-none focus:ring-2 focus:ring-f1-red text-gray-900 dark:text-white"
                  />
                  <span className="text-sm font-bold text-gray-500 dark:text-f1-muted">M</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PriceManager;
