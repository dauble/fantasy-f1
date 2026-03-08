import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import priceStorage from '../utils/priceStorage';
import setupStorage from '../utils/setupStorage';
import { DRIVER_PRICES, CONSTRUCTOR_PRICES, formatPrice, getDriverPrice, getConstructorPrice } from '../utils/pricing';
import openF1API from '../services/openF1API';

const PriceManager = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isSetupMode = searchParams.get('setup') === 'true';
  
  const [drivers, setDrivers] = useState([]);
  const [constructors, setConstructors] = useState([]);
  const [customPrices, setCustomPrices] = useState({ drivers: {}, constructors: {} });
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('');
  const [activeTab, setActiveTab] = useState('drivers'); // 'drivers' or 'constructors'

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load current drivers and constructors from API
      const driversData = await openF1API.getDrivers();
      const uniqueDrivers = Array.from(
        new Map(driversData.map(d => [d.driver_number, d])).values()
      );
      
      // Sort drivers by price (highest to lowest)
      const sortedDrivers = uniqueDrivers.sort((a, b) => 
        getDriverPrice(b.driver_number) - getDriverPrice(a.driver_number)
      );
      setDrivers(sortedDrivers);

      // Extract unique constructors
      const uniqueConstructors = Array.from(
        new Set(uniqueDrivers.map(d => d.team_name))
      );
      
      // Sort constructors by price (highest to lowest)
      const sortedConstructors = uniqueConstructors.sort((a, b) =>
        getConstructorPrice(b) - getConstructorPrice(a)
      );
      setConstructors(sortedConstructors);

      // Load custom prices
      const saved = priceStorage.getCustomPrices();
      if (saved) {
        setCustomPrices({
          drivers: saved.drivers || {},
          constructors: saved.constructors || {}
        });
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const handleDriverPriceChange = (driverNumber, value) => {
    const price = parseFloat(value) * 1000000; // Convert from millions to actual value
    
    if (isNaN(price) || price < 0) return;
    
    setCustomPrices(prev => ({
      ...prev,
      drivers: {
        ...prev.drivers,
        [driverNumber]: price
      }
    }));
  };

  const handleConstructorPriceChange = (teamName, value) => {
    const price = parseFloat(value) * 1000000;
    
    if (isNaN(price) || price < 0) return;
    
    setCustomPrices(prev => ({
      ...prev,
      constructors: {
        ...prev.constructors,
        [teamName]: price
      }
    }));
  };

  const handleSave = () => {
    setSaveStatus('saving');
    const success = priceStorage.saveCustomPrices(customPrices);
    
    if (success) {
      setSaveStatus('saved');
      
      // If in setup mode, mark setup complete and redirect
      if (isSetupMode) {
        setupStorage.markSetupComplete();
        setTimeout(() => {
          navigate('/');
        }, 1500);
      } else {
        setTimeout(() => setSaveStatus(''), 3000);
      }
    } else {
      setSaveStatus('error');
    }
  };

  const handleResetToDefaults = () => {
    if (window.confirm('Reset all prices to defaults? This will clear your custom prices.')) {
      priceStorage.clearCustomPrices();
      setCustomPrices({ drivers: {}, constructors: {} });
      setSaveStatus('reset');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const handleExport = () => {
    const success = priceStorage.exportPricesCSV(customPrices);
    if (success) {
      alert('Prices exported successfully! 📦');
    } else {
      alert('Failed to export prices. Please try again.');
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      const imported = await priceStorage.importPricesCSV(file);
      setCustomPrices(imported);
      alert('Prices imported successfully! Click "Save Changes" to apply. ✅');
    } catch (error) {
      alert('Failed to import prices. Please check the file format.');
    }
    
    event.target.value = '';
  };

  const getCurrentPrice = (type, identifier) => {
    if (type === 'driver') {
      return customPrices.drivers[identifier] || DRIVER_PRICES[identifier] || 8000000;
    } else {
      return customPrices.constructors[identifier] || CONSTRUCTOR_PRICES[identifier] || 10000000;
    }
  };

  const hasCustomPrice = (type, identifier) => {
    if (type === 'driver') {
      return customPrices.drivers[identifier] !== undefined;
    } else {
      return customPrices.constructors[identifier] !== undefined;
    }
  };

  const getPriceChange = (type, identifier) => {
    if (type === 'driver') {
      return priceStorage.getDriverPriceChange(identifier);
    } else {
      return priceStorage.getConstructorPriceChange(identifier);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold mb-6">Price Manager</h1>
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Setup Mode Banner */}
      {isSetupMode && (
        <div className="mb-6 bg-gradient-to-r from-f1-red to-f1-red-dark text-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center gap-4">
            <span className="text-4xl">🏁</span>
            <div>
              <h2 className="text-2xl font-bold mb-1">Initial Setup: Update Your Prices</h2>
              <p className="text-white text-opacity-90">
                Enter the current driver and constructor prices from the official Fantasy F1 site, then click "Save Changes" to continue.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          {isSetupMode ? 'Step 1: Set Your Prices' : 'Manage Driver & Constructor Prices'}
        </h1>
        <p className="text-gray-600">
          {isSetupMode 
            ? 'Visit fantasy.formula1.com to get the latest prices, then enter them below'
            : 'Update prices each week to match the official Fantasy F1 site'
          }
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
        >
          {saveStatus === 'saving' ? '💾 Saving...' : isSetupMode ? '💾 Save & Continue to Team Builder' : '💾 Save Changes'}
        </button>
        {!isSetupMode && (
          <>
            <button
              onClick={handleResetToDefaults}
              className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold transition-colors"
            >
              🔄 Reset to Defaults
            </button>
            <button
              onClick={handleExport}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
            >
              📦 Export CSV
            </button>
            <label className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold cursor-pointer transition-colors">
              📥 Import CSV
              <input
                type="file"
                accept=".csv"
                onChange={handleImport}
                className="hidden"
              />
            </label>
          </>
        )}
        {isSetupMode && (
          <button
            onClick={() => {
              setupStorage.markSetupComplete();
              navigate('/');
            }}
            className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
          >
            Skip & Use Defaults
          </button>
        )}
      </div>

      {/* Save Status */}
      {saveStatus && (
        <div className={`mb-6 p-4 rounded-lg ${
          saveStatus === 'saved' ? 'bg-green-100 text-green-800' :
          saveStatus === 'reset' ? 'bg-orange-100 text-orange-800' :
          saveStatus === 'error' ? 'bg-red-100 text-red-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          {saveStatus === 'saved' && (isSetupMode 
            ? '✅ Prices saved successfully! Redirecting to Team Builder...'
            : '✅ Prices saved successfully! Your updated prices are now active.'
          )}
          {saveStatus === 'reset' && '🔄 Prices reset to defaults.'}
          {saveStatus === 'error' && '❌ Failed to save prices. Please try again.'}
        </div>
      )}

      {/* Info Card */}
      <Card className="mb-6 bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">{isSetupMode ? 'Getting Started:' : 'How to use:'}</p>
              <ul className="list-disc list-inside space-y-1">
                {isSetupMode ? (
                  <>
                    <li>Visit <a href="https://fantasy.formula1.com" target="_blank" rel="noopener noreferrer" className="underline font-semibold">fantasy.formula1.com</a> to see current prices</li>
                    <li>Enter prices in millions below (e.g., "32.5" for $32.5M)</li>
                    <li>You can update just a few drivers or all of them - it's up to you</li>
                    <li>Click "Save & Continue" when ready, or "Skip" to use default prices</li>
                    <li>You can always return to update prices later from the navigation menu</li>
                  </>
                ) : (
                  <>
                    <li>Enter prices in millions (e.g., "32.5" for $32.5M)</li>
                    <li>Values highlighted in <span className="text-green-600 font-semibold">green</span> have custom prices set</li>
                    <li>Click "Save Changes" to apply your prices across the app</li>
                    <li>Export/import CSV files to share prices or backup your data</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Automatic Scraping Info */}
      {!isSetupMode && (
        <Card className="mb-6 bg-purple-50 border-purple-200">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🤖</span>
              <div className="flex-1">
                <h3 className="font-semibold text-purple-900 mb-2">Want Automatic Price Fetching?</h3>
                <p className="text-sm text-purple-800 mb-3">
                  Learn about options for automatically scraping prices from the official Fantasy F1 site, including backend setup, browser extensions, and community sources.
                </p>
                <button
                  onClick={() => navigate('/live-pricing')}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  📚 View Live Pricing Guide
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('drivers')}
          className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
            activeTab === 'drivers'
              ? 'border-f1-red text-f1-red'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          🏎️ Drivers ({drivers.length})
        </button>
        <button
          onClick={() => setActiveTab('constructors')}
          className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
            activeTab === 'constructors'
              ? 'border-f1-red text-f1-red'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          🏁 Constructors ({constructors.length})
        </button>
      </div>

      {/* Drivers Tab */}
      {activeTab === 'drivers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {drivers.map(driver => {
            const currentPrice = getCurrentPrice('driver', driver.driver_number);
            const isCustom = hasCustomPrice('driver', driver.driver_number);
            const priceChange = getPriceChange('driver', driver.driver_number);
            
            return (
              <Card key={driver.driver_number} className={isCustom ? 'border-2 border-green-500' : ''}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-gray-600">#{driver.driver_number}</span>
                        {isCustom && <span className="text-xs bg-green-500 text-white px-2 py-1 rounded">CUSTOM</span>}
                      </div>
                      <h3 className="font-bold text-lg">
                        {driver.full_name || `${driver.first_name} ${driver.last_name}`}
                      </h3>
                      <p className="text-sm text-gray-600">{driver.team_name}</p>
                    </div>
                    {priceChange && (
                      <div className={`text-right text-sm ${
                        priceChange.direction === 'up' ? 'text-green-600' :
                        priceChange.direction === 'down' ? 'text-red-600' :
                        'text-gray-600'
                      }`}>
                        <div className="font-bold">
                          {priceChange.direction === 'up' && '↑'}
                          {priceChange.direction === 'down' && '↓'}
                          {formatPrice(Math.abs(priceChange.change))}
                        </div>
                        <div className="text-xs">{priceChange.percentChange}%</div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">$</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="50"
                      value={(currentPrice / 1000000).toFixed(1)}
                      onChange={(e) => handleDriverPriceChange(driver.driver_number, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-f1-red focus:border-transparent"
                    />
                    <span className="text-sm font-medium text-gray-700">M</span>
                  </div>
                  
                  <p className="text-xs text-gray-500 mt-2">
                    Default: {formatPrice(DRIVER_PRICES[driver.driver_number] || 8000000)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Constructors Tab */}
      {activeTab === 'constructors' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {constructors.map(teamName => {
            const currentPrice = getCurrentPrice('constructor', teamName);
            const isCustom = hasCustomPrice('constructor', teamName);
            const priceChange = getPriceChange('constructor', teamName);
            
            return (
              <Card key={teamName} className={isCustom ? 'border-2 border-green-500' : ''}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg">{teamName}</h3>
                        {isCustom && <span className="text-xs bg-green-500 text-white px-2 py-1 rounded">CUSTOM</span>}
                      </div>
                    </div>
                    {priceChange && (
                      <div className={`text-right text-sm ${
                        priceChange.direction === 'up' ? 'text-green-600' :
                        priceChange.direction === 'down' ? 'text-red-600' :
                        'text-gray-600'
                      }`}>
                        <div className="font-bold">
                          {priceChange.direction === 'up' && '↑'}
                          {priceChange.direction === 'down' && '↓'}
                          {formatPrice(Math.abs(priceChange.change))}
                        </div>
                        <div className="text-xs">{priceChange.percentChange}%</div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">$</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="50"
                      value={(currentPrice / 1000000).toFixed(1)}
                      onChange={(e) => handleConstructorPriceChange(teamName, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-f1-red focus:border-transparent"
                    />
                    <span className="text-sm font-medium text-gray-700">M</span>
                  </div>
                  
                  <p className="text-xs text-gray-500 mt-2">
                    Default: {formatPrice(CONSTRUCTOR_PRICES[teamName] || 10000000)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PriceManager;
