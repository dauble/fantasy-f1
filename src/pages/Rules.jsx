import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import { FANTASY_BUDGET, MAX_DRIVERS, MAX_CONSTRUCTORS, POINTS, TURBO_MULTIPLIER } from '../config/api';
import { formatPrice } from '../utils/pricing';
import strategyAnalyzer, { getDriverNameByNumber } from '../utils/strategyAnalyzer';

const Rules = () => {
  const [strategyTips, setStrategyTips] = useState([]);
  const [loadingTips, setLoadingTips] = useState(true);

  useEffect(() => {
    fetchStrategyTips();
  }, []);

  const fetchStrategyTips = async () => {
    setLoadingTips(true);
    try {
      const tips = await strategyAnalyzer.generateStrategyTips();
      setStrategyTips(tips);
    } catch (error) {
      console.error('Error fetching strategy tips:', error);
      setStrategyTips(strategyAnalyzer.getDefaultTips());
    } finally {
      setLoadingTips(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold mb-2 dark:text-white">Fantasy F1 Rules</h1>
        <p className="text-gray-600 dark:text-gray-300">Understanding how to play and score points</p>
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
              <p className="text-gray-700 dark:text-gray-200">
                You have a total budget of <strong>{formatPrice(FANTASY_BUDGET)}</strong> to build your team.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Team Composition</h4>
              <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-200">
                <li>Select <strong>{MAX_DRIVERS} drivers</strong></li>
                <li>Select <strong>{MAX_CONSTRUCTORS} constructors</strong> (teams)</li>
                <li>Total cost must not exceed your budget</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Turbo Driver</h4>
              <p className="text-gray-700 dark:text-gray-200">
                Choose one of your drivers as your <strong className="text-yellow-600 dark:text-yellow-300">Turbo Driver</strong>. 
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
                  <div key={position} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
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
                  <div key={position} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                    <span className="font-medium">P{position}</span>
                    <span className="font-bold text-f1-red">{points} points</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold mb-3">Bonus Points</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/30 rounded border border-green-200 dark:border-green-700">
                <span>🏁 Fastest Lap</span>
                <span className="font-bold text-green-700 dark:text-green-300">+{POINTS.fastestLap}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/30 rounded border border-green-200 dark:border-green-700">
                <span>📈 Position Gained</span>
                <span className="font-bold text-green-700 dark:text-green-300">+{POINTS.positionGained} each</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/30 rounded border border-green-200 dark:border-green-700">
                <span>✓ Beat Teammate (Qual)</span>
                <span className="font-bold text-green-700 dark:text-green-300">+{POINTS.beaten_teammate_qualifying}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/30 rounded border border-green-200 dark:border-green-700">
                <span>✓ Beat Teammate (Race)</span>
                <span className="font-bold text-green-700 dark:text-green-300">+{POINTS.beaten_teammate_race}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/30 rounded border border-green-200 dark:border-green-700">
                <span>✓ Classified Finish</span>
                <span className="font-bold text-green-700 dark:text-green-300">+{POINTS.classified}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold mb-3">Penalties</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/30 rounded border border-red-200 dark:border-red-700">
                <span>📉 Position Lost</span>
                <span className="font-bold text-red-700 dark:text-red-300">{POINTS.positionLost} each</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/30 rounded border border-red-200 dark:border-red-700">
                <span>❌ Not Classified</span>
                <span className="font-bold text-red-700 dark:text-red-300">{POINTS.notClassified}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/30 rounded border border-red-200 dark:border-red-700">
                <span>🚫 Disqualified</span>
                <span className="font-bold text-red-700 dark:text-red-300">{POINTS.disqualified}</span>
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
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 dark:border-yellow-500 rounded">
              <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">Turbo Driver (⚡)</h4>
              <p className="text-yellow-800 dark:text-yellow-200">
                Your selected Turbo Driver scores <strong>double points</strong> for the entire race weekend 
                (qualifying + race). Choose wisely based on circuit characteristics and recent form!
              </p>
            </div>
            
            <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-400 dark:border-blue-500 rounded">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Limitless Chip (Coming Soon)</h4>
              <p className="text-blue-800 dark:text-blue-200">
                Remove the budget cap for one race weekend. Build the ultimate dream team!
              </p>
            </div>
            
            <div className="p-4 bg-purple-50 dark:bg-purple-900/30 border-l-4 border-purple-400 dark:border-purple-500 rounded">
              <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">Wildcard (Coming Soon)</h4>
              <p className="text-purple-800 dark:text-purple-200">
                Make unlimited free transfers to completely rebuild your team.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Strategy Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>💡 Data-Driven Strategy Tips</span>
            {!loadingTips && (
              <button
                onClick={fetchStrategyTips}
                className="text-sm text-f1-red hover:text-red-700 font-normal"
                title="Refresh strategy tips"
              >
                🔄 Refresh
              </button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTips ? (
            <div className="space-y-3">
              <LoadingSkeleton variant="card" count={4} />
            </div>
          ) : (
            <>
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-400 dark:border-blue-500 rounded">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>📊 Based on Historical Data:</strong> These insights are generated from analyzing 
                  recent race performances, consistency patterns, and value metrics from this season's completed races.
                </p>
              </div>
              
              <div className="space-y-4">
                {strategyTips.map((tip, index) => (
                  <div key={index} className="p-4 bg-gradient-to-r from-gray-50 to-white dark:from-gray-700/30 dark:to-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-f1-red transition-colors">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-2xl">{tip.icon}</span>
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg mb-2">{tip.title}</h4>
                        <p className="text-sm text-gray-700 dark:text-gray-200 mb-3">{tip.description}</p>
                        
                        {tip.drivers && tip.drivers.length > 0 && (
                          <div className="space-y-2 mt-3">
                            {tip.drivers.map((driver, driverIndex) => (
                              <div 
                                key={driverIndex}
                                className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 hover:border-f1-red transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-f1-red text-white flex items-center justify-center font-bold text-sm">
                                    #{driver.number}
                                  </div>
                                  <div>
                                    <div className="font-semibold">
                                      {getDriverNameByNumber(driver.number)}
                                    </div>
                                    <div className="text-xs text-gray-600 dark:text-gray-300 space-x-3">
                                      {driver.avgPosition && (
                                        <span>Avg: P{driver.avgPosition}</span>
                                      )}
                                      {driver.consistency && (
                                        <span className="text-green-600 dark:text-green-300">
                                          {driver.consistency}% consistency
                                        </span>
                                      )}
                                      {driver.topTenRate && (
                                        <span className="text-blue-600 dark:text-blue-200">
                                          Top 10: {driver.topTenRate}
                                        </span>
                                      )}
                                      {driver.topFiveRate && (
                                        <span className="text-yellow-600 dark:text-yellow-300">
                                          Top 5: {driver.topFiveRate}
                                        </span>
                                      )}
                                      {driver.bestFinish && (
                                        <span className="text-purple-600 dark:text-purple-300">
                                          Best: P{driver.bestFinish}
                                        </span>
                                      )}
                                      {driver.races && (
                                        <span className="text-gray-500 dark:text-gray-300">
                                          ({driver.races} races)
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {strategyTips.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-300">
                  <p className="mb-2">📊 No race data available yet this season.</p>
                  <p className="text-sm">Strategy tips will appear after the first few races are completed.</p>
                </div>
              )}
              
                <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                  <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2 flex items-center gap-2">
                    <span>💡</span>
                    <span>General Tips</span>
                  </h4>
                  <ul className="space-y-2 text-sm text-yellow-800 dark:text-yellow-200">
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-600 dark:text-yellow-400">•</span>
                    <span><strong>Circuit Types:</strong> Some drivers excel on street circuits (Monaco, Singapore) 
                    while others perform better on high-speed tracks (Monza, Spa).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-600 dark:text-yellow-400">•</span>
                    <span><strong>Turbo Strategy:</strong> Save your Turbo Driver for races where they have 
                    strong historical performance at that specific circuit.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-600 dark:text-yellow-400">•</span>
                    <span><strong>Weather Wildcards:</strong> Wet races can shuffle the order dramatically. 
                    Some drivers (like Verstappen, Hamilton, Norris) excel in changing conditions.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-600 dark:text-yellow-400">•</span>
                    <span><strong>Constructor Strategy:</strong> Mid-field teams can offer great value if both 
                    drivers consistently score points. Don't overlook teams like Aston Martin or Alpine.</span>
                  </li>
                </ul>
              </div>
            </>
          )}
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
