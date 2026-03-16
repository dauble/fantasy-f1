// Team Storage utility for persisting Fantasy F1 team selections

const TEAM_STORAGE_KEY = 'fantasy_f1_current_team';
const TEAMS_HISTORY_KEY = 'fantasy_f1_teams_history';

export const teamStorage = {
  // Save current team
  saveCurrentTeam(teamData) {
    try {
      const team = {
        ...teamData,
        lastSaved: new Date().toISOString(),
        id: teamData.id || Date.now()
      };
      localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(team));
      console.log('Team saved successfully');
      return true;
    } catch (error) {
      console.error('Error saving team:', error);
      return false;
    }
  },

  // Load current team
  loadCurrentTeam() {
    try {
      const saved = localStorage.getItem(TEAM_STORAGE_KEY);
      if (!saved) return null;
      
      const team = JSON.parse(saved);
      console.log('Team loaded successfully');
      return team;
    } catch (error) {
      console.error('Error loading team:', error);
      return null;
    }
  },

  // Clear current team
  clearCurrentTeam() {
    try {
      localStorage.removeItem(TEAM_STORAGE_KEY);
      console.log('Team cleared successfully');
      return true;
    } catch (error) {
      console.error('Error clearing team:', error);
      return false;
    }
  },

  // Save team to history (for weekly tracking)
  saveToHistory(teamData, weekLabel = null) {
    try {
      const history = this.getTeamHistory();
      const week = weekLabel || `Week ${new Date().toISOString().split('T')[0]}`;
      
      const teamEntry = {
        id: Date.now(),
        week,
        ...teamData,
        savedAt: new Date().toISOString()
      };
      
      history.unshift(teamEntry); // Add to beginning
      
      // Keep only last 20 weeks
      const trimmedHistory = history.slice(0, 20);
      
      localStorage.setItem(TEAMS_HISTORY_KEY, JSON.stringify(trimmedHistory));
      console.log('Team saved to history');
      return true;
    } catch (error) {
      console.error('Error saving team to history:', error);
      return false;
    }
  },

  // Get team history
  getTeamHistory() {
    try {
      const saved = localStorage.getItem(TEAMS_HISTORY_KEY);
      if (!saved) return [];
      
      return JSON.parse(saved);
    } catch (error) {
      console.error('Error loading team history:', error);
      return [];
    }
  },

  // Load team from history by ID
  loadFromHistory(teamId) {
    try {
      const history = this.getTeamHistory();
      const team = history.find(t => t.id === teamId);
      
      if (team) {
        // Load this historical team as current team
        this.saveCurrentTeam(team);
        return team;
      }
      
      return null;
    } catch (error) {
      console.error('Error loading team from history:', error);
      return null;
    }
  },

  // Delete team from history
  deleteFromHistory(teamId) {
    try {
      const history = this.getTeamHistory();
      const filtered = history.filter(t => t.id !== teamId);
      
      localStorage.setItem(TEAMS_HISTORY_KEY, JSON.stringify(filtered));
      console.log('Team deleted from history');
      return true;
    } catch (error) {
      console.error('Error deleting team from history:', error);
      return false;
    }
  },

  // Save the current active team as a backup entry in history with a GUID id.
  // Useful for preserving the team before applying AI recommendations.
  saveBackupToHistory(label) {
    try {
      const current = this.loadCurrentTeam();
      if (!current) return false; // nothing to back up
      const history = this.getTeamHistory();
      const entry = {
        ...current,
        id: crypto.randomUUID(),
        week: label,
        source: 'ai_backup',
        savedAt: new Date().toISOString(),
      };
      history.unshift(entry);
      localStorage.setItem(TEAMS_HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
      console.log('Team backed up to history:', label);
      return true;
    } catch (error) {
      console.error('Error saving backup to history:', error);
      return false;
    }
  },

  // Export team as JSON
  exportTeam(teamData) {
    try {
      const exportData = {
        ...teamData,
        exportedAt: new Date().toISOString(),
        appVersion: '1.0.0'
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
        type: 'application/json' 
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `fantasy-f1-team-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error('Error exporting team:', error);
      return false;
    }
  },

  // Import team from JSON
  async importTeam(file) {
    try {
      const text = await file.text();
      const teamData = JSON.parse(text);
      
      // Validate basic structure
      if (!teamData.selectedDrivers || !teamData.selectedConstructors) {
        throw new Error('Invalid team file format');
      }
      
      return teamData;
    } catch (error) {
      console.error('Error importing team:', error);
      throw error;
    }
  },

  // Get storage statistics
  getStorageStats() {
    try {
      const currentTeam = this.loadCurrentTeam();
      const history = this.getTeamHistory();
      
      return {
        hasCurrentTeam: !!currentTeam,
        historyCount: history.length,
        lastSaved: currentTeam?.lastSaved || null
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return {
        hasCurrentTeam: false,
        historyCount: 0,
        lastSaved: null
      };
    }
  }
};

export default teamStorage;
