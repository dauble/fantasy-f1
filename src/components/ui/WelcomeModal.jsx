import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from './Card';
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Card className="shadow-2xl border-f1-border overflow-hidden">
          {/* Red header */}
          <div className="bg-gradient-to-r from-f1-red to-f1-red-dark px-5 py-6 text-white text-center">
            <p className="text-4xl mb-3">🏎️</p>
            <h2 className="text-xl font-black uppercase tracking-tight">Welcome to Fantasy F1!</h2>
            <p className="text-sm text-white/80 mt-1">Let's get your team ready for race week</p>
          </div>

          <CardContent className="pt-5 pb-5">
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wide">
                  Update driver & constructor prices?
                </h3>
                <p className="text-sm text-gray-500 dark:text-f1-muted mt-1">
                  Prices change weekly on the official Fantasy F1 site.
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/30 rounded-xl p-3.5">
                <div className="flex items-start gap-3">
                  <span className="text-lg flex-shrink-0">💡</span>
                  <div className="text-xs text-blue-900 dark:text-blue-300 space-y-1">
                    <p className="font-bold mb-1">Why update prices?</p>
                    <ul className="list-disc list-inside space-y-0.5 text-blue-800 dark:text-blue-400">
                      <li>Match the official Fantasy F1 site values</li>
                      <li>Accurate budget calculations ($100M limit)</li>
                      <li>Reflect driver performance changes</li>
                      <li>Updatable anytime from Price Manager</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleSetupPrices}
                  className="w-full px-5 py-3.5 bg-f1-red hover:bg-f1-red-dark text-white rounded-xl font-black uppercase tracking-wide text-sm transition-colors shadow-lg shadow-f1-red/30"
                >
                  Update Prices Now (Recommended)
                </button>

                <button
                  onClick={handleUseDefaults}
                  className="w-full px-5 py-3 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-white rounded-xl font-bold uppercase tracking-wide text-sm transition-colors"
                >
                  Use Default Prices
                </button>

                <button
                  onClick={handleSkipSetup}
                  className="w-full px-5 py-2.5 text-gray-400 dark:text-f1-muted hover:text-gray-600 dark:hover:text-white font-semibold text-sm transition-colors"
                >
                  Skip for now
                </button>
              </div>

              <p className="text-[10px] text-center text-gray-400 dark:text-f1-muted">
                Access Price Manager anytime from the navigation
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WelcomeModal;
