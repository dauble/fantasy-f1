import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import openF1API from '../services/openF1API';
import { POINTS, TURBO_MULTIPLIER } from '../config/api';
import { getDriverPrice } from '../utils/pricing';
import { getDriverColor } from '../utils/teamColors';

const Predictions = () => {
  const [meetings, setMeetings] = useState([]);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMeetings();
  }, []);

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
      { driver: 'Max Verstappen', number: 1, predicted_position: 1, qualifying: 1 },
      { driver: 'Charles Leclerc', number: 16, predicted_position: 2, qualifying: 2 },
      { driver: 'Lando Norris', number: 4, predicted_position: 3, qualifying: 3 },
      { driver: 'Lewis Hamilton', number: 44, predicted_position: 4, qualifying: 5 },
      { driver: 'George Russell', number: 63, predicted_position: 5, qualifying: 4 },
      { driver: 'Carlos Sainz', number: 55, predicted_position: 6, qualifying: 6 },
      { driver: 'Oscar Piastri', number: 81, predicted_position: 7, qualifying: 8 },
      { driver: 'Fernando Alonso', number: 14, predicted_position: 8, qualifying: 7 },
      { driver: 'Sergio Perez', number: 11, predicted_position: 9, qualifying: 10 },
      { driver: 'Pierre Gasly', number: 10, predicted_position: 10, qualifying: 9 },
    ];

    const predictionsWithPoints = driverPredictions.map(pred => ({
      ...pred,
      points: calculatePredictedPoints(pred.predicted_position, pred.qualifying)
    }));

    setPredictions(predictionsWithPoints);
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

      {/* Info Banner */}
      <Card className="mb-6 bg-blue-50 border-blue-200">
        <CardContent>
          <p className="text-sm text-blue-800">
            <strong>ℹ️ Note:</strong> These predictions are based on historical performance, 
            current form, and circuit characteristics. Select your Turbo Driver wisely for 2x points!
          </p>
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
                  <th className="px-4 py-3 text-center">Qual</th>
                  <th className="px-4 py-3 text-center">Race</th>
                  <th className="px-4 py-3 text-center">Points</th>
                  <th className="px-4 py-3 text-center">w/ Turbo</th>
                </tr>
              </thead>
              <tbody>
                {predictions.map((pred, index) => (
                  <tr 
                    key={pred.number}
                    className={`border-b border-gray-100 hover:bg-gray-50 ${
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
                        <span className="font-semibold">{pred.driver}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">P{pred.qualifying}</td>
                    <td className="px-4 py-3 text-center">P{pred.predicted_position}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-bold text-f1-red">{pred.points}</span>
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
