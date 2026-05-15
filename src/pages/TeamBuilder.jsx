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
  const [saveStatus, setSaveStatus] = useState('');
  const [showCompleteBanner, setShowCompleteBanner] = useState(false);

  useEffect(() => {
    fetchData();
    loadSavedTeam();
  }, []);

  useEffect(() => {
    if (selectedDrivers.length === MAX_DRIVERS && selectedConstructors.length === MAX_CONSTRUCTORS) {
      setShowCompleteBanner(true);
      const timer = setTimeout(() => setShowCompleteBanner(false), 5000);
      return () => clearTimeout(timer);
    } else {
      setShowCompleteBanner(false);
    }
  }, [selectedDrivers.length, selectedConstructors.length]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const latestSession = await openF1API.getLatestSession();
      if (latestSession) {
        const driversData = await openF1API.getDrivers();
        const uniqueDrivers = Array.from(
          new Map(driversData.map(d => [d.driver_number, d])).values()
        );
        setDrivers(uniqueDrivers);
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
    }
  };

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
      if (turboDriver?.driver_number === driver.driver_number) setTurboDriver(null);
    } else {
      if (selectedDrivers.length < MAX_DRIVERS) {
        const newSelection = [...selectedDrivers, driver];
        if (calculateTotalPrice(newSelection, selectedConstructors) <= FANTASY_BUDGET) {
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
        if (calculateTotalPrice(selectedDrivers, newSelection) <= FANTASY_BUDGET) {
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
    setTurboDriver(turboDriver?.driver_number === driver.driver_number ? null : driver);
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
        selectedDrivers, selectedConstructors, turboDriver,
        totalSpent: calculateTotalPrice(selectedDrivers, selectedConstructors)
      };
      const success = teamStorage.saveToHistory(teamData, weekLabel);
      if (success) {
        alert(`Team saved to history as "${weekLabel}"!`);
      } else {
        alert('Failed to save team to history. Please try again.');
      }
    }
  };

  const handleExportTeam = () => {
    const teamData = {
      selectedDrivers, selectedConstructors, turboDriver,
      totalSpent: calculateTotalPrice(selectedDrivers, selectedConstructors)
    };
    const success = teamStorage.exportTeam(teamData);
    if (!success) alert('Failed to export team. Please try again.');
  };

  const handleImportTeam = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const teamData = await teamStorage.importTeam(file);
      setSelectedDrivers(teamData.selectedDrivers || []);
      setSelectedConstructors(teamData.selectedConstructors || []);
      setTurboDriver(teamData.turboDriver || null);
      alert('Team imported successfully!');
    } catch {
      alert('Failed to import team. Please check the file format.');
    }
    event.target.value = '';
  };

  const totalSpent = calculateTotalPrice(selectedDrivers, selectedConstructors);
  const remainingBudget = FANTASY_BUDGET - totalSpent;
  const budgetPercentage = (totalSpent / FANTASY_BUDGET) * 100;

  if (loading) {
    return (
      <div className="px-4 py-6">
        <h1 className="text-2xl font-black uppercase tracking-tight text-gray-900 dark:text-white mb-6">Team Builder</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <LoadingSkeleton variant="card" count={6} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-f1-red">Failed to Load Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                Unable to load driver and constructor data from the OpenF1 API.
              </p>
              <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 p-4 rounded-r-lg">
                <h4 className="font-bold text-amber-800 dark:text-amber-300 mb-2 uppercase text-sm tracking-wide">Common causes</h4>
                <ul className="list-disc list-inside text-sm text-amber-700 dark:text-amber-400 space-y-1">
                  <li><strong>Rate Limiting (429):</strong> Wait a few minutes and retry.</li>
                  <li><strong>Network Issues:</strong> Check your internet connection.</li>
                  <li><strong>API Downtime:</strong> OpenF1 may be temporarily unavailable.</li>
                </ul>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                <strong>Error:</strong> {error}
              </p>
              <button
                onClick={fetchData}
                className="w-full px-4 py-3 bg-f1-red hover:bg-f1-red-dark text-white rounded-xl font-bold uppercase tracking-wide transition-colors"
              >
                Retry
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 py-5">

      {/* Page header */}
      <div className="mb-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-gray-900 dark:text-white leading-none">
              Build Your Team
            </h1>
            <p className="text-sm text-gray-500 dark:text-f1-muted mt-1">
              5 drivers · 2 constructors · $100M budget
            </p>
          </div>
          {lastSaved && (
            <div className="text-xs text-gray-400 dark:text-f1-muted sm:text-right">
              {saveStatus === 'saving' && <span className="text-amber-500">Saving…</span>}
              {saveStatus === 'saved' && <span className="text-emerald-500">Saved</span>}
              {saveStatus === 'error' && <span className="text-f1-red">Save failed</span>}
              {!saveStatus && <span>Saved {new Date(lastSaved).toLocaleTimeString()}</span>}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 mt-3">
          {[
            { label: 'Save to History', onClick: handleSaveToHistory, disabled: selectedDrivers.length === 0 && selectedConstructors.length === 0 },
            { label: 'Export', onClick: handleExportTeam, disabled: selectedDrivers.length === 0 && selectedConstructors.length === 0 },
            { label: 'Clear Team', onClick: handleClearTeam, disabled: selectedDrivers.length === 0 && selectedConstructors.length === 0, danger: true },
          ].map(({ label, onClick, disabled, danger }) => (
            <button
              key={label}
              onClick={onClick}
              disabled={disabled}
              className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-touch ${
                danger
                  ? 'bg-red-100 dark:bg-red-900/30 text-f1-red hover:bg-red-200 dark:hover:bg-red-900/50'
                  : 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white hover:bg-gray-200 dark:hover:bg-white/20'
              }`}
            >
              {label}
            </button>
          ))}
          <label className="px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white hover:bg-gray-200 dark:hover:bg-white/20 cursor-pointer transition-colors min-h-touch flex items-center">
            Import
            <input type="file" accept=".json" onChange={handleImportTeam} className="hidden" />
          </label>
        </div>
      </div>

      {/* Budget card */}
      <div className="mb-5 rounded-xl bg-gradient-to-r from-f1-red to-f1-red-dark p-4 text-white shadow-lg shadow-f1-red/20">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-white/70">Remaining Budget</p>
            <p className="text-3xl font-black leading-none mt-0.5">{formatPrice(remainingBudget)}</p>
            <p className="text-xs text-white/70 mt-1">of {formatPrice(FANTASY_BUDGET)} total</p>
          </div>
          <div className="flex-1">
            <div className="w-full bg-white/20 rounded-full h-2">
              <div
                className="bg-white h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
              />
            </div>
            <p className="text-xs text-white/70 mt-1">{budgetPercentage.toFixed(1)}% used</p>
          </div>
          <div className="sm:text-right text-sm font-bold">
            <p>{selectedDrivers.length}/{MAX_DRIVERS} Drivers</p>
            <p>{selectedConstructors.length}/{MAX_CONSTRUCTORS} Constructors</p>
          </div>
        </div>
      </div>

      {/* Selected team summary */}
      {(selectedDrivers.length > 0 || selectedConstructors.length > 0) && (
        <div className="mb-5">
          <Card>
            <CardHeader>
              <CardTitle>Your Team</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDrivers.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-f1-muted mb-2">Drivers</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedDrivers.map(driver => (
                      <div
                        key={driver.driver_number}
                        className={`px-3 py-2 rounded-lg border flex items-center gap-2 text-sm ${
                          turboDriver?.driver_number === driver.driver_number
                            ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
                            : 'border-gray-200 dark:border-f1-border bg-gray-50 dark:bg-f1-elevated text-gray-800 dark:text-white'
                        }`}
                      >
                        <span className="font-black text-xs">#{driver.driver_number}</span>
                        <span className="font-semibold">
                          {driver.full_name || `${driver.first_name} ${driver.last_name}`}
                        </span>
                        {turboDriver?.driver_number === driver.driver_number && (
                          <span className="text-[10px] bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded font-black uppercase">
                            Turbo 2×
                          </span>
                        )}
                        <button
                          onClick={() => handleTurboSelect(driver)}
                          className="text-xs bg-gray-200 dark:bg-white/10 hover:bg-yellow-200 dark:hover:bg-yellow-500/30 rounded px-1.5 py-0.5 ml-1 transition-colors"
                          title="Set as Turbo Driver (2× points)"
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
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-f1-muted mb-2">Constructors</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedConstructors.map(constructor => (
                      <div
                        key={constructor.team_name}
                        className="px-3 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-f1-border bg-gray-50 dark:bg-f1-elevated text-gray-800 dark:text-white"
                      >
                        {constructor.team_name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Drivers section */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-6 bg-f1-red rounded-full" />
          <h2 className="text-lg font-black uppercase tracking-tight text-gray-900 dark:text-white">
            Drivers
          </h2>
          <span className="text-sm font-bold text-f1-muted">
            {selectedDrivers.length}/{MAX_DRIVERS}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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

      {/* Constructors section */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-6 bg-f1-red rounded-full" />
          <h2 className="text-lg font-black uppercase tracking-tight text-gray-900 dark:text-white">
            Constructors
          </h2>
          <span className="text-sm font-bold text-f1-muted">
            {selectedConstructors.length}/{MAX_CONSTRUCTORS}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
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

      {/* Team complete banner */}
      {showCompleteBanner && (
        <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-30">
          <div
            onClick={() => setShowCompleteBanner(false)}
            className="bg-emerald-600 text-white px-5 py-4 rounded-xl shadow-2xl flex items-center gap-3 cursor-pointer hover:bg-emerald-700 transition-colors"
          >
            <span className="text-2xl">🏁</span>
            <div>
              <p className="font-black uppercase tracking-wide text-sm">Team Complete!</p>
              <p className="text-xs text-white/80 mt-0.5">
                Auto-saved · {selectedDrivers.length} drivers · {selectedConstructors.length} constructors
              </p>
            </div>
            <span className="text-white/60 text-lg font-black ml-1">×</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamBuilder;
