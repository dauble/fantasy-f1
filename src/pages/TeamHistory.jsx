import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import teamStorage from '../utils/teamStorage';
import { formatPrice } from '../utils/pricing';

const TeamHistory = () => {
  const [history, setHistory] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    const savedHistory = teamStorage.getTeamHistory();
    setHistory(savedHistory);
  };

  const handleLoadTeam = (team) => {
    if (window.confirm(`Load this team as your current team? This will replace your current selections.`)) {
      teamStorage.loadFromHistory(team.id);
      alert('Team loaded! Go to Team Builder to see it. ✅');
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
    const success = teamStorage.exportTeam(team);
    if (success) {
      alert('Team exported successfully! 📦');
    }
  };

  if (history.length === 0) {
    return (
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold mb-6 dark:text-white">Team History</h1>
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400 text-lg mb-4">No saved teams yet</p>
            <p className="text-gray-500 text-sm">
              Use the "Save to History" button in Team Builder to save your teams for each race week.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold mb-2 dark:text-white">Team History</h1>
        <p className="text-gray-600 dark:text-gray-400">View and manage your saved teams from previous race weeks</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {history.map((team) => (
          <Card key={team.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="bg-gradient-to-r from-f1-red to-f1-red-dark text-white rounded py-1 px-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">{team.week}</CardTitle>
                <span className="text-sm opacity-90">
                  {new Date(team.savedAt).toLocaleDateString()}
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {/* Drivers */}
              <div className="mb-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  🏎️ Drivers ({team.selectedDrivers?.length || 0})
                </h3>
                <div className="space-y-1">
                  {team.selectedDrivers?.map((driver) => (
                    <div 
                      key={driver.driver_number}
                      className="flex items-center justify-between text-sm py-1 px-2 bg-gray-50 dark:bg-gray-700 rounded"
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-bold text-gray-600">#{driver.driver_number}</span>
                        <span>{driver.full_name || `${driver.first_name} ${driver.last_name}`}</span>
                        {team.turboDriver?.driver_number === driver.driver_number && (
                          <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded">TURBO</span>
                        )}
                      </span>
                      <span className="text-gray-500">{driver.team_name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Constructors */}
              <div className="mb-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  🏁 Constructors ({team.selectedConstructors?.length || 0})
                </h3>
                <div className="space-y-1">
                  {team.selectedConstructors?.map((constructor) => (
                    <div 
                      key={constructor.team_name}
                      className="text-sm py-1 px-2 bg-gray-50 dark:bg-gray-700 rounded"
                    >
                      {constructor.team_name}
                    </div>
                  ))}
                </div>
              </div>

              {/* Budget Info */}
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-semibold text-blue-900">
                  Total Spent: {formatPrice(team.totalSpent || 0)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleLoadTeam(team)}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Load Team
                </button>
                <button
                  onClick={() => handleExportTeam(team)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  📦 Export
                </button>
                <button
                  onClick={() => handleDeleteTeam(team.id)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  🗑️
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
