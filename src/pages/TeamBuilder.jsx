import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import DriverCard from '../components/team/DriverCard';
import ConstructorCard from '../components/team/ConstructorCard';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import openF1API from '../services/openF1API';
import { getDriverPrice, getConstructorPrice, calculateTotalPrice, formatPrice } from '../utils/pricing';
import { FANTASY_BUDGET, MAX_DRIVERS, MAX_CONSTRUCTORS } from '../config/api';
import teamStorage from '../utils/teamStorage';

const TeamBuilder = () => {
  const [drivers, setDrivers] = useState([]);
  const [constructors, setConstructors] = useState([]);
  const [selectedDrivers, setSelectedDrivers] = useState([]);
  const [selectedConstructors, setSelectedConstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [turboDriver, setTurboDriver] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);
  const [saveStatus, setSaveStatus] = useState(''); // 'saving', 'saved', 'error'
  const [showCompleteBanner, setShowCompleteBanner] = useState(false);

  useEffect(() => {
    fetchData();
    loadSavedTeam();
  }, []);

  // Auto-dismiss Team Complete banner after 5 seconds
  useEffect(() => {
    if (selectedDrivers.length === MAX_DRIVERS && selectedConstructors.length === MAX_CONSTRUCTORS) {
      setShowCompleteBanner(true);
      
      const timer = setTimeout(() => {
        setShowCompleteBanner(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    } else {
      setShowCompleteBanner(false);
    }
  }, [selectedDrivers.length, selectedConstructors.length]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Get latest session to fetch current drivers
      const latestSession = await openF1API.getLatestSession();
      
      if (latestSession) {
        // Get drivers from the latest session
        const driversData = await openF1API.getDrivers();
        
        // Remove duplicates by driver_number
        const uniqueDrivers = Array.from(
          new Map(driversData.map(d => [d.driver_number, d])).values()
        );
        
        setDrivers(uniqueDrivers);

        // Extract unique constructors from drivers
        const uniqueConstructors = Array.from(
          new Set(uniqueDrivers.map(d => d.team_name))
        ).map(teamName => ({
          team_name: teamName,
          team_colour: uniqueDrivers.find(d => d.team_name === teamName)?.team_colour
        }));
        
        setConstructors(uniqueConstructors);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load driver and constructor data');
      setLoading(false);
    }
  };

  const loadSavedTeam = () => {
    const savedTeam = teamStorage.loadCurrentTeam();
    if (savedTeam) {
      setSelectedDrivers(savedTeam.selectedDrivers || []);
      setSelectedConstructors(savedTeam.selectedConstructors || []);
      setTurboDriver(savedTeam.turboDriver || null);
      setLastSaved(savedTeam.lastSaved);
      console.log('Loaded saved team:', savedTeam);
    }
  };

  // Auto-save team whenever selections change
  useEffect(() => {
    if (selectedDrivers.length > 0 || selectedConstructors.length > 0) {
      const teamData = {
        selectedDrivers,
        selectedConstructors,
        turboDriver,
        totalSpent: calculateTotalPrice(selectedDrivers, selectedConstructors)
      };
      
      setSaveStatus('saving');
      const success = teamStorage.saveCurrentTeam(teamData);
      
      if (success) {
        setSaveStatus('saved');
        setLastSaved(new Date().toISOString());
        
        // Clear status after 2 seconds
        setTimeout(() => setSaveStatus(''), 2000);
      } else {
        setSaveStatus('error');
      }
    }
  }, [selectedDrivers, selectedConstructors, turboDriver]);

  const handleDriverSelect = (driver) => {
    const isSelected = selectedDrivers.some(d => d.driver_number === driver.driver_number);
    
    if (isSelected) {
      setSelectedDrivers(selectedDrivers.filter(d => d.driver_number !== driver.driver_number));
      if (turboDriver?.driver_number === driver.driver_number) {
        setTurboDriver(null);
      }
    } else {
      if (selectedDrivers.length < MAX_DRIVERS) {
        const newSelection = [...selectedDrivers, driver];
        const newTotal = calculateTotalPrice(newSelection, selectedConstructors);
        
        if (newTotal <= FANTASY_BUDGET) {
          setSelectedDrivers(newSelection);
        } else {
          alert('This selection exceeds your budget!');
        }
      } else {
        alert(`You can only select ${MAX_DRIVERS} drivers`);
      }
    }
  };

  const handleConstructorSelect = (constructor) => {
    const isSelected = selectedConstructors.some(c => c.team_name === constructor.team_name);
    
    if (isSelected) {
      setSelectedConstructors(selectedConstructors.filter(c => c.team_name !== constructor.team_name));
    } else {
      if (selectedConstructors.length < MAX_CONSTRUCTORS) {
        const newSelection = [...selectedConstructors, constructor];
        const newTotal = calculateTotalPrice(selectedDrivers, newSelection);
        
        if (newTotal <= FANTASY_BUDGET) {
          setSelectedConstructors(newSelection);
        } else {
          alert('This selection exceeds your budget!');
        }
      } else {
        alert(`You can only select ${MAX_CONSTRUCTORS} constructors`);
      }
    }
  };

  const handleTurboSelect = (driver) => {
    if (turboDriver?.driver_number === driver.driver_number) {
      setTurboDriver(null);
    } else {
      setTurboDriver(driver);
    }
  };

  const handleClearTeam = () => {
    if (window.confirm('Are you sure you want to clear your team? This cannot be undone.')) {
      setSelectedDrivers([]);
      setSelectedConstructors([]);
      setTurboDriver(null);
      teamStorage.clearCurrentTeam();
      setLastSaved(null);
    }
  };

  const handleSaveToHistory = () => {
    const weekLabel = prompt('Enter a label for this team (e.g., "Race Week 5", "Monaco GP"):');
    if (weekLabel) {
      const teamData = {
        selectedDrivers,
        selectedConstructors,
        turboDriver,
        totalSpent: calculateTotalPrice(selectedDrivers, selectedConstructors)
      };
      
      const success = teamStorage.saveToHistory(teamData, weekLabel);
      if (success) {
        alert(`Team saved to history as "${weekLabel}"! ✅`);
      } else {
        alert('Failed to save team to history. Please try again.');
      }
    }
  };

  const handleExportTeam = () => {
    const teamData = {
      selectedDrivers,
      selectedConstructors,
      turboDriver,
      totalSpent: calculateTotalPrice(selectedDrivers, selectedConstructors)
    };
    
    const success = teamStorage.exportTeam(teamData);
    if (success) {
      alert('Team exported successfully! Check your downloads folder. 📦');
    } else {
      alert('Failed to export team. Please try again.');
    }
  };

  const handleImportTeam = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      const teamData = await teamStorage.importTeam(file);
      
      // Validate that we still have the drivers/constructors available
      setSelectedDrivers(teamData.selectedDrivers || []);
      setSelectedConstructors(teamData.selectedConstructors || []);
      setTurboDriver(teamData.turboDriver || null);
      
      alert('Team imported successfully! ✅');
    } catch (error) {
      alert('Failed to import team. Please check the file format.');
    }
    
    // Reset file input
    event.target.value = '';
  };

  const totalSpent = calculateTotalPrice(selectedDrivers, selectedConstructors);
  const remainingBudget = FANTASY_BUDGET - totalSpent;
  const budgetPercentage = (totalSpent / FANTASY_BUDGET) * 100;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold mb-6 dark:text-white">Team Builder</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <LoadingSkeleton variant="card" count={6} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Card variant="default">
          <CardHeader>
            <CardTitle className="text-red-600">⚠️ Failed to Load Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-gray-700">
                Unable to load driver and constructor data from the OpenF1 API.
              </p>
              
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <h4 className="font-semibold text-yellow-800 mb-2">Common causes:</h4>
                <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                  <li><strong>Rate Limiting (429 Error):</strong> Too many API requests. Wait a few minutes and try again.</li>
                  <li><strong>Network Issues:</strong> Check your internet connection.</li>
                  <li><strong>API Downtime:</strong> The OpenF1 API may be temporarily unavailable.</li>
                  <li><strong>CORS Issues:</strong> Browser security may be blocking the request.</li>
                </ul>
              </div>
              
              <p className="text-sm text-gray-600">
                <strong>Error details:</strong> {error}
              </p>
              
              <button 
                onClick={fetchData}
                className="w-full px-4 py-3 bg-f1-red text-white rounded-lg hover:bg-f1-red-dark font-semibold transition-colors"
              >
                🔄 Retry Loading Data
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2 dark:text-white">Build Your Fantasy F1 Team</h1>
            <p className="text-gray-600 dark:text-gray-400">Select 5 drivers and 2 constructors within your $100M budget</p>
          </div>
          
          {/* Save Status */}
          {lastSaved && (
            <div className="flex items-center gap-2 text-sm">
              {saveStatus === 'saving' && (
                <span className="text-gray-600 dark:text-gray-400">💾 Saving...</span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-green-600">✅ Auto-saved</span>
              )}
              {saveStatus === 'error' && (
                <span className="text-red-600">❌ Save failed</span>
              )}
              {!saveStatus && (
                <span className="text-gray-500">
                  Last saved: {new Date(lastSaved).toLocaleString()}
                </span>
              )}
            </div>
          )}
        </div>
        
        {/* Team Management Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSaveToHistory}
            disabled={selectedDrivers.length === 0 && selectedConstructors.length === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            📝 Save to History
          </button>
          <button
            onClick={handleExportTeam}
            disabled={selectedDrivers.length === 0 && selectedConstructors.length === 0}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            📦 Export Team
          </button>
          <label className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium cursor-pointer transition-colors">
            📥 Import Team
            <input
              type="file"
              accept=".json"
              onChange={handleImportTeam}
              className="hidden"
            />
          </label>
          <button
            onClick={handleClearTeam}
            disabled={selectedDrivers.length === 0 && selectedConstructors.length === 0}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            🗑️ Clear Team
          </button>
        </div>
      </div>

      {/* Budget Display */}
      <Card className="mb-6 bg-gradient-to-r from-f1-red to-f1-red-dark text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Budget</h3>
            <p className="text-3xl font-bold">{formatPrice(remainingBudget)}</p>
            <p className="text-sm opacity-90">Remaining of {formatPrice(FANTASY_BUDGET)}</p>
          </div>
          <div className="flex-1 max-w-md">
            <div className="w-full bg-white bg-opacity-20 rounded-full h-4">
              <div 
                className="bg-white h-4 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
              ></div>
            </div>
            <p className="text-sm mt-1">{budgetPercentage.toFixed(1)}% of budget used</p>
          </div>
          <div className="text-right">
            <p className="text-sm opacity-90">Selected</p>
            <p className="text-2xl font-bold">{selectedDrivers.length}/{MAX_DRIVERS} Drivers</p>
            <p className="text-2xl font-bold">{selectedConstructors.length}/{MAX_CONSTRUCTORS} Constructors</p>
          </div>
        </div>
      </Card>

      {/* Selected Team Summary */}
      {(selectedDrivers.length > 0 || selectedConstructors.length > 0) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Your Team</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDrivers.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold mb-2">Drivers:</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedDrivers.map(driver => (
                    <div 
                      key={driver.driver_number}
                      className={`px-3 py-2 rounded-lg border-2 flex items-center gap-2 ${
                        turboDriver?.driver_number === driver.driver_number 
                          ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30' 
                          : 'border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700'
                      }`}
                    >
                      <span className="font-bold">#{driver.driver_number}</span>
                      <span>{driver.full_name || `${driver.first_name} ${driver.last_name}`}</span>
                      {turboDriver?.driver_number === driver.driver_number && (
                        <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-1 rounded">TURBO 2x</span>
                      )}
                      <button
                        onClick={() => handleTurboSelect(driver)}
                        className="text-xs bg-gray-200 hover:bg-yellow-400 dark:bg-gray-700 dark:hover:bg-yellow-600 dark:text-white px-2 py-1 rounded ml-2"
                        title="Set as Turbo Driver (2x points)"
                      >
                        ⚡
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedConstructors.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Constructors:</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedConstructors.map(constructor => (
                    <div 
                      key={constructor.team_name}
                      className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 dark:text-gray-100"
                    >
                      {constructor.team_name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Drivers Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Select Drivers ({selectedDrivers.length}/{MAX_DRIVERS})</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {drivers
            .sort((a, b) => getDriverPrice(b.driver_number) - getDriverPrice(a.driver_number))
            .map(driver => (
              <DriverCard
                key={driver.driver_number}
                driver={driver}
                price={getDriverPrice(driver.driver_number)}
                selected={selectedDrivers.some(d => d.driver_number === driver.driver_number)}
                onSelect={handleDriverSelect}
                disabled={
                  selectedDrivers.length >= MAX_DRIVERS && 
                  !selectedDrivers.some(d => d.driver_number === driver.driver_number)
                }
              />
            ))}
        </div>
      </div>

      {/* Constructors Section */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Select Constructors ({selectedConstructors.length}/{MAX_CONSTRUCTORS})</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {constructors
            .sort((a, b) => getConstructorPrice(b.team_name) - getConstructorPrice(a.team_name))
            .map(constructor => (
              <ConstructorCard
                key={constructor.team_name}
                constructor={constructor}
                price={getConstructorPrice(constructor.team_name)}
                selected={selectedConstructors.some(c => c.team_name === constructor.team_name)}
                onSelect={handleConstructorSelect}
                disabled={
                  selectedConstructors.length >= MAX_CONSTRUCTORS && 
                  !selectedConstructors.some(c => c.team_name === constructor.team_name)
                }
              />
            ))}
        </div>
      </div>

      {/* Team Complete Banner */}
      {showCompleteBanner && (
        <div className="fixed bottom-6 right-6 z-30">
          <div 
            onClick={() => setShowCompleteBanner(false)}
            className="bg-green-600 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 cursor-pointer hover:bg-green-700 transition-colors"
          >
            <span className="text-2xl">🏁</span>
            <div>
              <p className="font-bold text-lg">Team Complete!</p>
              <p className="text-sm opacity-90">Auto-saved • {selectedDrivers.length} drivers • {selectedConstructors.length} constructors</p>
            </div>
            <button 
              className="ml-2 text-white opacity-75 hover:opacity-100 text-xl font-bold"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamBuilder;
