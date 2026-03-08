import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import openF1API from '../services/openF1API';
import { POINTS, TURBO_MULTIPLIER } from '../config/api';
import { getDriverPrice, getConstructorPrice, formatPrice } from '../utils/pricing';
import { getDriverColor } from '../utils/teamColors';
import teamStorage from '../utils/teamStorage';

const Predictions = () => {
  const [meetings, setMeetings] = useState([]);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTeam, setCurrentTeam] = useState(null);

  useEffect(() => {
    fetchMeetings();
    loadCurrentTeam();
  }, []);

  const loadCurrentTeam = () => {
    const team = teamStorage.loadCurrentTeam();
    setCurrentTeam(team);
  };

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const currentYear = new Date().getFullYear();
      const meetingsData = await openF1API.getMeetings(currentYear);
      
      // Sort by date in ascending order (earliest race first, latest race last)
      const sortedMeetings = meetingsData.sort((a, b) => 
        new Date(a.date_start) - new Date(b.date_start)
      );
      
      setMeetings(sortedMeetings); // Show all races
      
      // Select the next upcoming race or the first race if none upcoming
      const now = new Date();
      const upcomingRace = sortedMeetings.find(m => new Date(m.date_start) >= now);
      setSelectedMeeting(upcomingRace || sortedMeetings[0]);
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching meetings:', err);
      setLoading(false);
    }
  };

  const calculatePredictedPoints = (position, qualifyingPosition) => {
    let points = 0;
    
    // Race position points
    if (POINTS.position[position]) {
      points += POINTS.position[position];
    }
    
    // Qualifying position points
    if (POINTS.qualifying[qualifyingPosition]) {
      points += POINTS.qualifying[qualifyingPosition];
    }
    
    // Position gain bonus (simplified)
    const positionChange = qualifyingPosition - position;
    if (positionChange > 0) {
      points += positionChange * POINTS.positionGained;
    } else if (positionChange < 0) {
      points += Math.abs(positionChange) * POINTS.positionLost;
    }
    
    // Classified bonus
    if (position <= 20) {
      points += POINTS.classified;
    }
    
    // Random chance for fastest lap (top 5 drivers)
    if (position <= 5 && Math.random() > 0.7) {
      points += POINTS.fastestLap;
    }
    
    return points;
  };

  const generatePredictions = () => {
    // This is a simplified prediction system
    // In a real app, you'd use historical data, ML models, etc.
    const driverPredictions = [
      { driver: 'Max Verstappen', number: 1, team: 'Red Bull Racing', predicted_position: 1, qualifying: 1 },
      { driver: 'Charles Leclerc', number: 16, team: 'Ferrari', predicted_position: 2, qualifying: 2 },
      { driver: 'Lando Norris', number: 4, team: 'McLaren', predicted_position: 3, qualifying: 3 },
      { driver: 'Lewis Hamilton', number: 44, team: 'Mercedes', predicted_position: 4, qualifying: 5 },
      { driver: 'George Russell', number: 63, team: 'Mercedes', predicted_position: 5, qualifying: 4 },
      { driver: 'Carlos Sainz', number: 55, team: 'Ferrari', predicted_position: 6, qualifying: 6 },
      { driver: 'Oscar Piastri', number: 81, team: 'McLaren', predicted_position: 7, qualifying: 8 },
      { driver: 'Fernando Alonso', number: 14, team: 'Aston Martin', predicted_position: 8, qualifying: 7 },
      { driver: 'Sergio Perez', number: 11, team: 'Red Bull Racing', predicted_position: 9, qualifying: 10 },
      { driver: 'Pierre Gasly', number: 10, team: 'Alpine', predicted_position: 10, qualifying: 9 },
      { driver: 'Lance Stroll', number: 18, team: 'Aston Martin', predicted_position: 11, qualifying: 11 },
      { driver: 'Esteban Ocon', number: 31, team: 'Alpine', predicted_position: 12, qualifying: 13 },
      { driver: 'Alexander Albon', number: 23, team: 'Williams', predicted_position: 13, qualifying: 12 },
      { driver: 'Yuki Tsunoda', number: 22, team: 'RB', predicted_position: 14, qualifying: 14 },
      { driver: 'Daniel Ricciardo', number: 3, team: 'RB', predicted_position: 15, qualifying: 16 },
      { driver: 'Valtteri Bottas', number: 77, team: 'Kick Sauber', predicted_position: 16, qualifying: 15 },
      { driver: 'Logan Sargeant', number: 2, team: 'Williams', predicted_position: 17, qualifying: 17 },
      { driver: 'Zhou Guanyu', number: 24, team: 'Kick Sauber', predicted_position: 18, qualifying: 18 },
    ];

    const predictionsWithPoints = driverPredictions.map(pred => {
      const points = calculatePredictedPoints(pred.predicted_position, pred.qualifying);
      const price = getDriverPrice(pred.number);
      const valueScore = (points / (price / 1000000)).toFixed(2); // Points per million
      const isSelected = currentTeam?.drivers?.includes(pred.number);
      
      return {
        ...pred,
        points,
        price,
        valueScore: parseFloat(valueScore),
        isSelected
      };
    });

    // Sort by value score (best value at top)
    const sortedByValue = [...predictionsWithPoints].sort((a, b) => b.valueScore - a.valueScore);

    setPredictions(predictionsWithPoints);
    return sortedByValue;
  };

  useEffect(() => {
    if (selectedMeeting) {
      generatePredictions();
    }
  }, [selectedMeeting]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold mb-6">Points Predictions</h1>
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Points Predictions</h1>
        <p className="text-gray-600">Predicted driver performances and fantasy points</p>
      </div>

      {/* Meeting Selector */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Race</CardTitle>
        </CardHeader>
        <CardContent>
          <select 
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-f1-red"
            value={selectedMeeting?.meeting_key || ''}
            onChange={(e) => {
              const meeting = meetings.find(m => m.meeting_key === parseInt(e.target.value));
              setSelectedMeeting(meeting);
            }}
          >
            {meetings.map(meeting => (
              <option key={meeting.meeting_key} value={meeting.meeting_key}>
                {meeting.meeting_name} - {new Date(meeting.date_start).toLocaleDateString()}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Value Analysis */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>💎 Best Value Picks - {selectedMeeting?.meeting_name}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Top drivers ranked by value (predicted points per million dollars). Green = In your team.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...predictions]
              .sort((a, b) => b.valueScore - a.valueScore)
              .slice(0, 9)
              .map((pred, index) => (
                <div
                  key={pred.number}
                  className={`p-4 rounded-lg border-2 ${
                    pred.isSelected
                      ? 'bg-green-50 border-green-500'
                      : 'bg-white border-gray-200 hover:border-f1-red'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-f1-red text-white flex items-center justify-center text-sm font-bold">
                        #{index + 1}
                      </div>
                      <div>
                        <div className="font-bold text-sm">{pred.driver}</div>
                        <div className="text-xs text-gray-500">{pred.team}</div>
                      </div>
                    </div>
                    {pred.isSelected && (
                      <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                        ✓ Selected
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-gray-500">Price</div>
                      <div className="font-semibold">{formatPrice(pred.price)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Pred. Pos</div>
                      <div className="font-semibold">P{pred.predicted_position}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Points</div>
                      <div className="font-semibold text-f1-red">{pred.points}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Value</div>
                      <div className="font-bold text-green-600">{pred.valueScore} pts/$M</div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
          
          {/* Constructor Value Analysis */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="font-semibold mb-3">🏗️ Constructor Value</h4>
            <p className="text-sm text-gray-600 mb-4">
              Based on combined predicted performance of team drivers.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { team: 'Red Bull Racing', avgPosition: 5, price: getConstructorPrice('Red Bull Racing') },
                { team: 'Ferrari', avgPosition: 4, price: getConstructorPrice('Ferrari') },
                { team: 'McLaren', avgPosition: 5, price: getConstructorPrice('McLaren') },
                { team: 'Mercedes', avgPosition: 4.5, price: getConstructorPrice('Mercedes') },
                { team: 'Aston Martin', avgPosition: 9.5, price: getConstructorPrice('Aston Martin') },
                { team: 'Alpine', avgPosition: 11, price: getConstructorPrice('Alpine') },
              ]
                .map(con => {
                  const estimatedPoints = Math.round(50 / con.avgPosition);
                  const valueScore = (estimatedPoints / (con.price / 1000000)).toFixed(2);
                  const isSelected = currentTeam?.constructors?.includes(con.team);
                  return { ...con, estimatedPoints, valueScore: parseFloat(valueScore), isSelected };
                })
                .sort((a, b) => b.valueScore - a.valueScore)
                .map((con, index) => (
                  <div
                    key={con.team}
                    className={`p-4 rounded-lg border-2 ${
                      con.isSelected
                        ? 'bg-green-50 border-green-500'
                        : 'bg-white border-gray-200 hover:border-f1-red'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-f1-red text-white flex items-center justify-center text-sm font-bold">
                          #{index + 1}
                        </div>
                        <div className="font-bold">{con.team}</div>
                      </div>
                      {con.isSelected && (
                        <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                          ✓ Selected
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-gray-500">Price</div>
                        <div className="font-semibold">{formatPrice(con.price)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Est. Points</div>
                        <div className="font-semibold text-f1-red">~{con.estimatedPoints}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Value</div>
                        <div className="font-bold text-green-600">{con.valueScore} pts/$M</div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Budget Optimization Tip */}
          {currentTeam && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-semibold text-yellow-900 mb-2">💡 Budget Optimization</h4>
              <p className="text-sm text-yellow-800">
                Your current team: {formatPrice(currentTeam.totalSpent || 0)} / $100M
                {currentTeam.totalSpent > 100000000 && (
                  <span className="text-red-600 font-semibold ml-2">⚠️ Over budget!</span>
                )}
                {currentTeam.totalSpent <= 100000000 && (
                  <span className="text-green-600 font-semibold ml-2">
                    ✓ Remaining: {formatPrice(100000000 - (currentTeam.totalSpent || 0))}
                  </span>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Predictions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Predicted Results - {selectedMeeting?.meeting_name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="px-4 py-3 text-left">Pos</th>
                  <th className="px-4 py-3 text-left">Driver</th>
                  <th className="px-4 py-3 text-center">Price</th>
                  <th className="px-4 py-3 text-center">Qual</th>
                  <th className="px-4 py-3 text-center">Race</th>
                  <th className="px-4 py-3 text-center">Points</th>
                  <th className="px-4 py-3 text-center">Value</th>
                  <th className="px-4 py-3 text-center">w/ Turbo</th>
                </tr>
              </thead>
              <tbody>
                {predictions.map((pred, index) => (
                  <tr 
                    key={pred.number}
                    className={`border-b border-gray-100 hover:bg-gray-50 ${
                      pred.isSelected ? 'bg-green-50' :
                      index < 3 ? 'bg-yellow-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        index === 0 ? 'bg-yellow-400 text-yellow-900' :
                        index === 1 ? 'bg-gray-300 text-gray-900' :
                        index === 2 ? 'bg-orange-400 text-orange-900' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {pred.predicted_position}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                          style={{ backgroundColor: getDriverColor('') }}
                        >
                          {pred.number}
                        </div>
                        <div>
                          <div className="font-semibold">{pred.driver}</div>
                          {pred.isSelected && (
                            <span className="text-xs text-green-600 font-semibold">✓ In Your Team</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm">{formatPrice(pred.price)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">P{pred.qualifying}</td>
                    <td className="px-4 py-3 text-center">P{pred.predicted_position}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-bold text-f1-red">{pred.points}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-semibold text-green-600">{pred.valueScore}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-bold text-yellow-600">
                        {pred.points * TURBO_MULTIPLIER}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Points Breakdown */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Points System</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Race Finishing Points</h4>
              <div className="space-y-1 text-sm">
                {Object.entries(POINTS.position).map(([pos, pts]) => (
                  <div key={pos} className="flex justify-between">
                    <span>P{pos}:</span>
                    <span className="font-semibold">{pts} pts</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Qualifying Points</h4>
              <div className="space-y-1 text-sm">
                {Object.entries(POINTS.qualifying).slice(0, 10).map(([pos, pts]) => (
                  <div key={pos} className="flex justify-between">
                    <span>P{pos}:</span>
                    <span className="font-semibold">{pts} pts</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Bonus Points</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Fastest Lap:</span>
                  <span className="font-semibold">{POINTS.fastestLap} pts</span>
                </div>
                <div className="flex justify-between">
                  <span>Position Gained:</span>
                  <span className="font-semibold">+{POINTS.positionGained} pts each</span>
                </div>
                <div className="flex justify-between">
                  <span>Beat Teammate (Qual):</span>
                  <span className="font-semibold">{POINTS.beaten_teammate_qualifying} pts</span>
                </div>
                <div className="flex justify-between">
                  <span>Beat Teammate (Race):</span>
                  <span className="font-semibold">{POINTS.beaten_teammate_race} pts</span>
                </div>
                <div className="flex justify-between">
                  <span>Classified:</span>
                  <span className="font-semibold">{POINTS.classified} pt</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Penalties</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Position Lost:</span>
                  <span className="font-semibold text-red-600">{POINTS.positionLost} pts each</span>
                </div>
                <div className="flex justify-between">
                  <span>Not Classified:</span>
                  <span className="font-semibold text-red-600">{POINTS.notClassified} pts</span>
                </div>
                <div className="flex justify-between">
                  <span>Disqualified:</span>
                  <span className="font-semibold text-red-600">{POINTS.disqualified} pts</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Predictions;
