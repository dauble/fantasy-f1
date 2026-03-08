import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from './Card';
import setupStorage from '../../utils/setupStorage';

const WelcomeModal = ({ onClose }) => {
  const navigate = useNavigate();

  const handleSetupPrices = () => {
    onClose();
    navigate('/prices?setup=true');
  };

  const handleSkipSetup = () => {
    setupStorage.dismissOnboarding();
    onClose();
  };

  const handleUseDefaults = () => {
    setupStorage.markSetupComplete();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <Card className="shadow-2xl">
          <CardHeader className="bg-gradient-to-r from-f1-red to-f1-red-dark text-white">
            <div className="text-center">
              <div className="text-6xl mb-4">🏎️</div>
              <CardTitle className="text-white text-3xl mb-2">Welcome to Fantasy F1!</CardTitle>
              <p className="text-white text-opacity-90">Let's get your team ready for race week</p>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {/* Main Question */}
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Would you like to update driver and constructor prices?
                </h3>
                <p className="text-gray-600">
                  Prices change weekly on the official Fantasy F1 site. Update them now to match this week's values.
                </p>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">💡</span>
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-2">Why update prices?</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Match the official Fantasy F1 website values</li>
                      <li>Accurate budget calculations within your $100M limit</li>
                      <li>Reflect driver performance and market changes</li>
                      <li>You can always update them later from the Price Manager</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleSetupPrices}
                  className="w-full px-6 py-4 bg-f1-red hover:bg-f1-red-dark text-white rounded-lg font-bold text-lg transition-colors shadow-lg"
                >
                  💰 Update Prices Now (Recommended)
                </button>
                
                <button
                  onClick={handleUseDefaults}
                  className="w-full px-6 py-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
                >
                  📊 Use Default Prices
                </button>
                
                <button
                  onClick={handleSkipSetup}
                  className="w-full px-6 py-3 text-gray-600 hover:text-gray-900 font-medium transition-colors"
                >
                  Skip for now
                </button>
              </div>

              {/* Footer Note */}
              <p className="text-xs text-center text-gray-500 mt-4">
                You can access the Price Manager anytime from the navigation menu
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WelcomeModal;
