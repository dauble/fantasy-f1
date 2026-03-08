import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';

const LivePricingGuide = () => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Live Pricing Guide</h1>
        <p className="text-gray-600">Options for automatically fetching Fantasy F1 prices</p>
      </div>

      {/* Overview Card */}
      <Card className="mb-6 bg-yellow-50 border-yellow-300">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <span className="text-3xl">⚠️</span>
            <div>
              <h3 className="font-bold text-yellow-900 mb-2">Important Limitations</h3>
              <p className="text-sm text-yellow-800 mb-2">
                The official Fantasy F1 website doesn't provide a public API. Automatic price fetching requires:
              </p>
              <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1 ml-4">
                <li>Backend server (Node.js/Python) - Can't be done from browser alone</li>
                <li>Your Fantasy F1 login credentials stored on server</li>
                <li>Compliance with Fantasy F1 terms of service</li>
                <li>May break if Fantasy F1 changes their site structure</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-3 font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'overview'
              ? 'border-f1-red text-f1-red'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          📋 Overview
        </button>
        <button
          onClick={() => setActiveTab('backend')}
          className={`px-4 py-3 font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'backend'
              ? 'border-f1-red text-f1-red'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          🖥️ Backend Setup
        </button>
        <button
          onClick={() => setActiveTab('extension')}
          className={`px-4 py-3 font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'extension'
              ? 'border-f1-red text-f1-red'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          🔌 Browser Extension
        </button>
        <button
          onClick={() => setActiveTab('community')}
          className={`px-4 py-3 font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'community'
              ? 'border-f1-red text-f1-red'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          👥 Community Sources
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Why Can't We Scrape Automatically?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-gray-700">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">🔒 Authentication Required</h4>
                  <p className="text-sm">Fantasy F1 requires you to be logged in to see prices. Your browser can't automatically log in without storing your credentials.</p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">🚫 CORS Restrictions</h4>
                  <p className="text-sm">Browsers block requests to Fantasy F1 from other domains for security. This is called Cross-Origin Resource Sharing (CORS).</p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">📜 Terms of Service</h4>
                  <p className="text-sm">Automated scraping may violate Fantasy F1's terms of service. Always respect website policies.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-green-50 border-green-300">
            <CardHeader>
              <CardTitle className="text-green-900">✅ Recommended Approach</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-green-800 mb-4">
                <strong>Manual Entry with CSV Import/Export</strong> is the most reliable and safest method:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-green-800 text-sm">
                <li>Visit fantasy.formula1.com each race week</li>
                <li>Note the new prices (takes 2-3 minutes)</li>
                <li>Enter them in the Price Manager</li>
                <li>Export as CSV to backup</li>
                <li>Share CSV with friends or import next week</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Backend Setup Tab */}
      {activeTab === 'backend' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>🖥️ Backend Service Setup (Advanced)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">What You'll Need:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                    <li>Node.js knowledge</li>
                    <li>A server (Vercel, Netlify Functions, Heroku, AWS Lambda)</li>
                    <li>Your Fantasy F1 credentials (stored securely)</li>
                    <li>30-60 minutes setup time</li>
                  </ul>
                </div>

                <div className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-xs">{`// backend/server.js
const { Client } = require('f1-fantasy-api');
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());

app.get('/api/prices', async (req, res) => {
  try {
    const client = new Client();
    
    // Use environment variables for secrets
    await client.login(
      process.env.F1_EMAIL, 
      process.env.F1_PASSWORD
    );
    await client.init();
    
    const prices = {
      drivers: {},
      constructors: {},
      lastUpdated: new Date().toISOString()
    };
    
    // Extract driver prices
    client.drivers.forEach((driver, id) => {
      if (driver.driver_number && driver.price) {
        prices.drivers[driver.driver_number] = driver.price;
      }
    });
    
    // Extract constructor prices  
    client.constructors.forEach((constructor) => {
      if (constructor.name && constructor.price) {
        prices.constructors[constructor.name] = constructor.price;
      }
    });
    
    res.json(prices);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch prices',
      message: error.message 
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});`}</pre>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Steps:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                    <li>Create new Node.js project: <code className="bg-gray-100 px-2 py-1 rounded">npm init -y</code></li>
                    <li>Install dependencies: <code className="bg-gray-100 px-2 py-1 rounded">npm i f1-fantasy-api express cors</code></li>
                    <li>Create server.js with code above</li>
                    <li>Set environment variables for F1_EMAIL and F1_PASSWORD</li>
                    <li>Deploy to your hosting service</li>
                    <li>Update frontend to call your endpoint</li>
                  </ol>
                </div>

                <div className="bg-red-50 border-l-4 border-red-500 p-4">
                  <h4 className="font-semibold text-red-900 mb-2">⚠️ Security Warning</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-red-800">
                    <li>NEVER commit credentials to git</li>
                    <li>Always use environment variables</li>
                    <li>Enable rate limiting to prevent abuse</li>
                    <li>Consider caching to reduce API calls</li>
                    <li>Respect Fantasy F1 terms of service</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Browser Extension Tab */}
      {activeTab === 'extension' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>🔌 Browser Extension Approach</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-700">
                  Create a simple browser extension that extracts prices while you're logged into Fantasy F1. This avoids authentication issues since you're already logged in.
                </p>

                <div>
                  <h4 className="font-semibold mb-2">Pros:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-green-700">
                    <li>No backend server needed</li>
                    <li>Uses your existing login session</li>
                    <li>One-click extraction</li>
                    <li>Works entirely in your browser</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">How it works:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                    <li>Log into fantasy.formula1.com normally</li>
                    <li>Navigate to the drivers/teams page</li>
                    <li>Click extension icon</li>
                    <li>Extension extracts prices from the page HTML</li>
                    <li>Copies JSON to clipboard</li>
                    <li>Paste into the Import feature in this app</li>
                  </ol>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Basic Extension Structure:</h4>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs">
                    <pre>{`// manifest.json
{
  "manifest_version": 3,
  "name": "F1 Fantasy Price Extractor",
  "version": "1.0",
  "permissions": ["activeTab", "clipboardWrite"],
  "action": {
    "default_popup": "popup.html"
  },
  "content_scripts": [{
    "matches": ["https://fantasy.formula1.com/*"],
    "js": ["content.js"]
  }]
}

// content.js
function extractPrices() {
  const drivers = {};
  const constructors = {};
  
  // Customize selectors based on Fantasy F1 HTML
  document.querySelectorAll('.driver-item').forEach(el => {
    const number = el.dataset.driverNumber;
    const price = parseFloat(el.dataset.price) * 1000000;
    if (number) drivers[number] = price;
  });
  
  return { drivers, constructors };
}`}</pre>
                  </div>
                </div>

                <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> You'll need to inspect Fantasy F1's HTML structure to find the correct CSS selectors for driver numbers and prices.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Community Sources Tab */}
      {activeTab === 'community' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>👥 Community Data Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Reddit Communities:</h4>
                  <ul className="space-y-2">
                    <li>
                      <a 
                        href="https://reddit.com/r/FantasyF1" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-2"
                      >
                        📱 r/FantasyF1 <span className="text-xs text-gray-500">- Weekly price discussions</span>
                      </a>
                    </li>
                    <li>
                      <a 
                        href="https://reddit.com/r/formula1" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-2"
                      >
                        📱 r/formula1 <span className="text-xs text-gray-500">- General F1 community</span>
                      </a>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Community Spreadsheets:</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    Many Fantasy F1 players maintain shared Google Sheets with weekly price updates. Search for:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                    <li>"Fantasy F1 prices spreadsheet 2026"</li>
                    <li>"F1 Fantasy price tracker"</li>
                    <li>Fantasy F1 Discord servers</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">GitHub Repositories:</h4>
                  <ul className="space-y-2 text-sm">
                    <li>
                      <a 
                        href="https://github.com/search?q=fantasy+f1+prices" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Search GitHub for Fantasy F1 tools →
                      </a>
                    </li>
                    <li>
                      <a 
                        href="https://github.com/zeroclutch/f1-fantasy-api" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        f1-fantasy-api - Node.js library →
                      </a>
                    </li>
                  </ul>
                </div>

                <div className="bg-purple-50 border-l-4 border-purple-500 p-4">
                  <h4 className="font-semibold text-purple-900 mb-2">💡 Share Your Prices!</h4>
                  <p className="text-sm text-purple-800">
                    After updating your prices, export them as CSV and share with the community. You could:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-purple-800 mt-2">
                    <li>Post CSV to Reddit weekly</li>
                    <li>Create a GitHub repo with weekly updates</li>
                    <li>Share in Fantasy F1 Discord servers</li>
                    <li>Collaborate on a Google Sheet</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default LivePricingGuide;
