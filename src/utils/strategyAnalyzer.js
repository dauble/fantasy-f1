import openF1API from '../services/openF1API';
import { getDriverPrice } from './pricing';

// Analyze historical performance data to generate strategy insights
export const strategyAnalyzer = {
  
  // Fetch and analyze recent race results
  async analyzeRecentForm(year = new Date().getFullYear()) {
    try {
      const meetings = await openF1API.getMeetings(year);
      const now = new Date();
      
      // Get completed races (past races only)
      const completedRaces = meetings
        .filter(m => new Date(m.date_end) < now)
        .sort((a, b) => new Date(b.date_start) - new Date(a.date_start))
        .slice(0, 5); // Last 5 races
      
      if (completedRaces.length === 0) {
        return null; // No historical data yet this season
      }
      
      const driverStats = {};
      
      // Analyze each completed race
      for (const meeting of completedRaces) {
        const sessions = await openF1API.getSessions(meeting.meeting_key);
        const raceSessions = sessions.filter(s => s.session_name === 'Race');
        const qualifyingSessions = sessions.filter(s => 
          s.session_name === 'Qualifying' || s.session_name === 'Sprint Qualifying'
        );
        
        // Get race results
        for (const raceSession of raceSessions) {
          try {
            const positions = await openF1API.getSessionResults(raceSession.session_key);
            
            // Group by driver and get their final position
            const driverPositions = {};
            positions.forEach(pos => {
              if (!driverPositions[pos.driver_number] || 
                  new Date(pos.date) > new Date(driverPositions[pos.driver_number].date)) {
                driverPositions[pos.driver_number] = pos;
              }
            });
            
            // Calculate stats for each driver
            Object.values(driverPositions).forEach(pos => {
              const driverNum = pos.driver_number;
              if (!driverStats[driverNum]) {
                driverStats[driverNum] = {
                  driverNumber: driverNum,
                  races: 0,
                  totalPosition: 0,
                  topFiveFinishes: 0,
                  topTenFinishes: 0,
                  dnfs: 0,
                  bestFinish: 20,
                  meetingNames: []
                };
              }
              
              driverStats[driverNum].races++;
              driverStats[driverNum].totalPosition += pos.position;
              driverStats[driverNum].meetingNames.push(meeting.meeting_name);
              
              if (pos.position <= 5) driverStats[driverNum].topFiveFinishes++;
              if (pos.position <= 10) driverStats[driverNum].topTenFinishes++;
              if (pos.position < driverStats[driverNum].bestFinish) {
                driverStats[driverNum].bestFinish = pos.position;
              }
            });
          } catch (err) {
            console.error(`Error fetching race results for ${raceSession.session_key}:`, err);
          }
        }
      }
      
      // Calculate averages and consistency scores
      Object.keys(driverStats).forEach(driverNum => {
        const stats = driverStats[driverNum];
        stats.avgPosition = stats.totalPosition / stats.races;
        stats.consistency = stats.topTenFinishes / stats.races; // % of races in top 10
        stats.topFiveRate = stats.topFiveFinishes / stats.races;
        
        // Calculate value score
        const price = getDriverPrice(parseInt(driverNum));
        stats.price = price;
        // Value = consistency weighted by position and normalized by price
        stats.valueScore = (21 - stats.avgPosition) * stats.consistency / (price / 1000000);
      });
      
      return driverStats;
    } catch (error) {
      console.error('Error analyzing recent form:', error);
      return null;
    }
  },
  
  // Generate specific strategy tips based on data
  async generateStrategyTips(year = new Date().getFullYear()) {
    const driverStats = await this.analyzeRecentForm(year);
    
    if (!driverStats || Object.keys(driverStats).length === 0) {
      return this.getDefaultTips();
    }
    
    const drivers = Object.values(driverStats)
      .filter(d => d.races >= 2) // Need at least 2 races for meaningful data
      .sort((a, b) => a.avgPosition - b.avgPosition);
    
    const tips = [];
    
    // Tip 1: Value Picks - best value for money
    const valueDrivers = [...drivers]
      .filter(d => d.price < 15000000) // Mid-field budget
      .sort((a, b) => b.valueScore - a.valueScore)
      .slice(0, 3);
    
    if (valueDrivers.length > 0) {
      tips.push({
        title: 'Best Value Picks',
        icon: '💰',
        description: `Based on recent performance, these drivers offer the best points-per-dollar ratio:`,
        drivers: valueDrivers.map(d => ({
          number: d.driverNumber,
          avgPosition: d.avgPosition.toFixed(1),
          consistency: (d.consistency * 100).toFixed(0),
          races: d.races
        }))
      });
    }
    
    // Tip 2: Consistent Performers
    const consistentDrivers = [...drivers]
      .filter(d => d.consistency >= 0.6) // 60%+ top 10 finishes
      .sort((a, b) => b.consistency - a.consistency)
      .slice(0, 3);
    
    if (consistentDrivers.length > 0) {
      tips.push({
        title: 'Most Consistent Performers',
        icon: '📊',
        description: `These drivers consistently finish in the top 10 (${consistentDrivers[0]?.races || 0} recent races):`,
        drivers: consistentDrivers.map(d => ({
          number: d.driverNumber,
          avgPosition: d.avgPosition.toFixed(1),
          consistency: (d.consistency * 100).toFixed(0),
          topTenRate: `${d.topTenFinishes}/${d.races} races`
        }))
      });
    }
    
    // Tip 3: Top 5 Specialists
    const topFiveDrivers = [...drivers]
      .filter(d => d.topFiveRate >= 0.4) // 40%+ top 5 finishes
      .sort((a, b) => b.topFiveRate - a.topFiveRate)
      .slice(0, 3);
    
    if (topFiveDrivers.length > 0) {
      tips.push({
        title: 'Podium Contenders',
        icon: '🏆',
        description: `These drivers frequently finish in the top 5:`,
        drivers: topFiveDrivers.map(d => ({
          number: d.driverNumber,
          avgPosition: d.avgPosition.toFixed(1),
          topFiveRate: `${d.topFiveFinishes}/${d.races} races`,
          bestFinish: d.bestFinish
        }))
      });
    }
    
    // Tip 4: Recent Form Leaders
    const recentForm = [...drivers]
      .filter(d => d.races >= 3)
      .sort((a, b) => a.avgPosition - b.avgPosition)
      .slice(0, 3);
    
    if (recentForm.length > 0) {
      tips.push({
        title: 'Best Recent Form',
        icon: '🔥',
        description: `Drivers with the strongest average finishing positions recently:`,
        drivers: recentForm.map(d => ({
          number: d.driverNumber,
          avgPosition: d.avgPosition.toFixed(1),
          bestFinish: d.bestFinish,
          races: d.races
        }))
      });
    }
    
    return tips;
  },
  
  // Default tips when no data is available
  getDefaultTips() {
    return [
      {
        title: 'Balance Your Budget',
        icon: '💰',
        description: 'Don\'t spend all your budget on star drivers. Mid-field drivers can offer great value with overtaking opportunities and consistent points.',
        drivers: []
      },
      {
        title: 'Circuit Matters',
        icon: '🏁',
        description: 'Some drivers excel on specific circuit types. Monaco specialists, high-speed experts, and wet weather masters can provide an edge.',
        drivers: []
      },
      {
        title: 'Turbo Timing',
        icon: '⚡',
        description: 'Use your Turbo Driver on weekends where they\'re most likely to excel. Consider pole position chances, recent form, and circuit suitability.',
        drivers: []
      },
      {
        title: 'Constructor Value',
        icon: '🏗️',
        description: 'Constructors score points from both drivers. A strong mid-field team can outscore expensive top teams if both drivers finish well.',
        drivers: []
      }
    ];
  }
};

// Helper to get driver name from number (common mappings)
export const getDriverNameByNumber = (number) => {
  const driverMap = {
    1: 'Max Verstappen',
    11: 'Sergio Perez',
    16: 'Charles Leclerc',
    55: 'Carlos Sainz',
    44: 'Lewis Hamilton',
    63: 'George Russell',
    4: 'Lando Norris',
    81: 'Oscar Piastri',
    14: 'Fernando Alonso',
    18: 'Lance Stroll',
    10: 'Pierre Gasly',
    31: 'Esteban Ocon',
    23: 'Alexander Albon',
    2: 'Logan Sargeant',
    22: 'Yuki Tsunoda',
    3: 'Daniel Ricciardo',
    77: 'Valtteri Bottas',
    24: 'Zhou Guanyu',
    20: 'Kevin Magnussen',
    27: 'Nico Hulkenberg'
  };
  
  return driverMap[number] || `Driver #${number}`;
};

export default strategyAnalyzer;
