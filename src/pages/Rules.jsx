import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { FANTASY_BUDGET, MAX_DRIVERS, MAX_CONSTRUCTORS, POINTS, TURBO_MULTIPLIER } from '../config/api';
import { formatPrice } from '../utils/pricing';

const Rules = () => {
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Fantasy F1 Rules</h1>
        <p className="text-gray-600">Understanding how to play and score points</p>
      </div>

      {/* Team Selection Rules */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>🏎️ Team Selection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Budget</h4>
              <p className="text-gray-700">
                You have a total budget of <strong>{formatPrice(FANTASY_BUDGET)}</strong> to build your team.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Team Composition</h4>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                <li>Select <strong>{MAX_DRIVERS} drivers</strong></li>
                <li>Select <strong>{MAX_CONSTRUCTORS} constructors</strong> (teams)</li>
                <li>Total cost must not exceed your budget</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Turbo Driver</h4>
              <p className="text-gray-700">
                Choose one of your drivers as your <strong className="text-yellow-600">Turbo Driver</strong>. 
                This driver will score <strong>{TURBO_MULTIPLIER}x points</strong> for that race weekend!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scoring System */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>📊 Scoring System</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3 text-f1-red">Race Finishing Positions</h4>
              <div className="space-y-2">
                {Object.entries(POINTS.position).map(([position, points]) => (
                  <div key={position} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="font-medium">P{position}</span>
                    <span className="font-bold text-f1-red">{points} points</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3 text-f1-red">Qualifying Positions</h4>
              <div className="space-y-2">
                {Object.entries(POINTS.qualifying).slice(0, 10).map(([position, points]) => (
                  <div key={position} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="font-medium">P{position}</span>
                    <span className="font-bold text-f1-red">{points} points</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="font-semibold mb-3">Bonus Points</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded border border-green-200">
                <span>🏁 Fastest Lap</span>
                <span className="font-bold text-green-700">+{POINTS.fastestLap}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-50 rounded border border-green-200">
                <span>📈 Position Gained</span>
                <span className="font-bold text-green-700">+{POINTS.positionGained} each</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-50 rounded border border-green-200">
                <span>✓ Beat Teammate (Qual)</span>
                <span className="font-bold text-green-700">+{POINTS.beaten_teammate_qualifying}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-50 rounded border border-green-200">
                <span>✓ Beat Teammate (Race)</span>
                <span className="font-bold text-green-700">+{POINTS.beaten_teammate_race}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-50 rounded border border-green-200">
                <span>✓ Classified Finish</span>
                <span className="font-bold text-green-700">+{POINTS.classified}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="font-semibold mb-3">Penalties</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex justify-between items-center p-3 bg-red-50 rounded border border-red-200">
                <span>📉 Position Lost</span>
                <span className="font-bold text-red-700">{POINTS.positionLost} each</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-50 rounded border border-red-200">
                <span>❌ Not Classified</span>
                <span className="font-bold text-red-700">{POINTS.notClassified}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-50 rounded border border-red-200">
                <span>🚫 Disqualified</span>
                <span className="font-bold text-red-700">{POINTS.disqualified}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chips & Power-ups */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>⚡ Chips & Power-ups</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
              <h4 className="font-semibold text-yellow-900 mb-2">Turbo Driver (⚡)</h4>
              <p className="text-yellow-800">
                Your selected Turbo Driver scores <strong>double points</strong> for the entire race weekend 
                (qualifying + race). Choose wisely based on circuit characteristics and recent form!
              </p>
            </div>
            
            <div className="p-4 bg-blue-50 border-l-4 border-blue-400 rounded">
              <h4 className="font-semibold text-blue-900 mb-2">Limitless Chip (Coming Soon)</h4>
              <p className="text-blue-800">
                Remove the budget cap for one race weekend. Build the ultimate dream team!
              </p>
            </div>
            
            <div className="p-4 bg-purple-50 border-l-4 border-purple-400 rounded">
              <h4 className="font-semibold text-purple-900 mb-2">Wildcard (Coming Soon)</h4>
              <p className="text-purple-800">
                Make unlimited free transfers to completely rebuild your team.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Strategy Tips */}
      <Card>
        <CardHeader>
          <CardTitle>💡 Strategy Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold mb-2">1. Balance Your Budget</h4>
              <p className="text-sm text-gray-700">
                Don't spend all your budget on star drivers. Mid-field drivers can offer great value 
                with overtaking opportunities and consistent points.
              </p>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold mb-2">2. Circuit Matters</h4>
              <p className="text-sm text-gray-700">
                Some drivers excel on specific circuit types. Monaco specialists, high-speed experts, 
                and wet weather masters can provide an edge.
              </p>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold mb-2">3. Turbo Timing</h4>
              <p className="text-sm text-gray-700">
                Use your Turbo Driver on weekends where they're most likely to excel. Consider pole position 
                chances, recent form, and circuit suitability.
              </p>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold mb-2">4. Constructor Value</h4>
              <p className="text-sm text-gray-700">
                Constructors score points from both drivers. A strong mid-field team can outscore 
                expensive top teams if both drivers finish well.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* External Links */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>🔗 Official Resources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <a 
              href="https://fantasy.formula1.com/en/game-rules" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block p-3 bg-f1-red text-white rounded-lg hover:bg-f1-red-dark transition-colors"
            >
              📋 Official Fantasy F1 Game Rules →
            </a>
            <a 
              href="https://fantasy.formula1.com/en/how-to-play" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block p-3 bg-f1-red text-white rounded-lg hover:bg-f1-red-dark transition-colors"
            >
              🎮 How to Play Guide →
            </a>
            <a 
              href="https://openf1.org/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block p-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              📊 OpenF1 API (Data Source) →
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Rules;
