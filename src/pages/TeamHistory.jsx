import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import teamStorage from '../utils/teamStorage';
import { formatPrice } from '../utils/pricing';

const TeamHistory = () => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    setHistory(teamStorage.getTeamHistory());
  };

  const handleLoadTeam = (team) => {
    if (window.confirm('Load this team as your current team? This will replace your current selections.')) {
      teamStorage.loadFromHistory(team.id);
      alert('Team loaded! Go to Team Builder to see it.');
      window.location.href = '#/';
    }
  };

  const handleDeleteTeam = (teamId) => {
    if (window.confirm('Are you sure you want to delete this saved team?')) {
      teamStorage.deleteFromHistory(teamId);
      loadHistory();
    }
  };

  const handleExportTeam = (team) => {
    teamStorage.exportTeam(team);
  };

  if (history.length === 0) {
    return (
      <div className="px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1 h-6 bg-f1-red rounded-full" />
          <h1 className="text-2xl font-black uppercase tracking-tight text-gray-900 dark:text-white">Team History</h1>
        </div>
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-4xl mb-4">📋</p>
            <p className="font-black uppercase tracking-wide text-gray-600 dark:text-gray-300 mb-2">No saved teams yet</p>
            <p className="text-sm text-gray-500 dark:text-f1-muted">
              Use "Save to History" in Team Builder to save your team each race week.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 py-5">
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-6 bg-f1-red rounded-full" />
          <h1 className="text-2xl font-black uppercase tracking-tight text-gray-900 dark:text-white">Team History</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-f1-muted">
          Your saved teams from previous race weeks
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {history.map((team) => (
          <Card key={team.id}>
            {/* Card header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-f1-border">
              <h3 className="font-black uppercase tracking-wide text-gray-900 dark:text-white text-sm">
                {team.week}
              </h3>
              <span className="text-xs text-gray-400 dark:text-f1-muted">
                {new Date(team.savedAt).toLocaleDateString()}
              </span>
            </div>

            <CardContent className="p-0">
              {/* Drivers */}
              {team.selectedDrivers?.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-f1-muted mb-1.5">
                    Drivers ({team.selectedDrivers.length})
                  </p>
                  <div className="space-y-1">
                    {team.selectedDrivers.map((driver) => (
                      <div
                        key={driver.driver_number}
                        className="flex items-center justify-between text-sm py-1.5 px-2 bg-gray-50 dark:bg-f1-elevated rounded-lg"
                      >
                        <span className="flex items-center gap-2">
                          <span className="font-black text-xs text-gray-500 dark:text-f1-muted">#{driver.driver_number}</span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {driver.full_name || `${driver.first_name} ${driver.last_name}`}
                          </span>
                          {team.turboDriver?.driver_number === driver.driver_number && (
                            <span className="text-[9px] bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded font-black uppercase">
                              Turbo
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-f1-muted">{driver.team_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Constructors */}
              {team.selectedConstructors?.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-f1-muted mb-1.5">
                    Constructors ({team.selectedConstructors.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {team.selectedConstructors.map((constructor) => (
                      <span
                        key={constructor.team_name}
                        className="text-sm py-1 px-2.5 bg-gray-50 dark:bg-f1-elevated rounded-lg font-semibold text-gray-700 dark:text-white"
                      >
                        {constructor.team_name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Budget */}
              <div className="mb-4 px-3 py-2 bg-f1-red/10 dark:bg-f1-red/10 rounded-lg">
                <p className="text-xs font-bold uppercase tracking-wide text-f1-red">
                  Total: {formatPrice(team.totalSpent || 0)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleLoadTeam(team)}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wide transition-colors"
                >
                  Load Team
                </button>
                <button
                  onClick={() => handleExportTeam(team)}
                  className="px-3 py-2.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-600 dark:text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Export
                </button>
                <button
                  onClick={() => handleDeleteTeam(team.id)}
                  className="px-3 py-2.5 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-f1-red rounded-xl text-xs font-bold transition-colors"
                >
                  Delete
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default TeamHistory;
