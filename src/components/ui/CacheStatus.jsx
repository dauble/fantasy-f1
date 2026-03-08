import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './Card';
import openF1API from '../../services/openF1API';

const CacheStatus = () => {
  const [stats, setStats] = useState({ total: 0, valid: 0, expired: 0, sizeKB: 0 });
  const [showDetails, setShowDetails] = useState(false);

  const updateStats = () => {
    const cacheStats = openF1API.getCacheStats();
    setStats(cacheStats);
  };

  useEffect(() => {
    updateStats();
    
    // Update stats every 10 seconds
    const interval = setInterval(updateStats, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const handleClearCache = () => {
    if (window.confirm('Are you sure you want to clear all cached data? This will require fresh API calls.')) {
      openF1API.clearCache();
      updateStats();
      window.location.reload(); // Reload to fetch fresh data
    }
  };

  if (!showDetails) {
    return (
      <button
        onClick={() => setShowDetails(true)}
        className="fixed bottom-4 right-4 bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg text-xs hover:bg-gray-700 transition-colors z-50"
        title="View cache statistics"
      >
        📊 Cache: {stats.valid} items ({stats.sizeKB} KB)
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className="w-80 shadow-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Cache Status</CardTitle>
            <button
              onClick={() => setShowDetails(false)}
              className="text-gray-500 hover:text-gray-700 text-xl"
            >
              ×
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-2 bg-green-50 rounded">
              <span className="text-sm">Valid Entries</span>
              <span className="font-bold text-green-700">{stats.valid}</span>
            </div>
            
            {stats.expired > 0 && (
              <div className="flex justify-between items-center p-2 bg-yellow-50 rounded">
                <span className="text-sm">Expired Entries</span>
                <span className="font-bold text-yellow-700">{stats.expired}</span>
              </div>
            )}
            
            <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
              <span className="text-sm">Cache Size</span>
              <span className="font-bold text-blue-700">{stats.sizeKB} KB</span>
            </div>
            
            <div className="pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-600 mb-2">
                Cache prevents 429 rate limit errors by storing API responses for 5 minutes.
              </p>
              <button
                onClick={handleClearCache}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded text-sm transition-colors"
              >
                Clear Cache & Refresh
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CacheStatus;
