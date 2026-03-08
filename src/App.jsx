import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './layouts/Layout';
import TeamBuilder from './pages/TeamBuilder';
import Predictions from './pages/Predictions';
import Rules from './pages/Rules';
import TeamHistory from './pages/TeamHistory';
import PriceManager from './pages/PriceManager';
import LivePricingGuide from './pages/LivePricingGuide';
import WelcomeModal from './components/ui/WelcomeModal';
import setupStorage from './utils/setupStorage';

function App() {
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    // Check if this is first visit
    const isComplete = setupStorage.isSetupComplete();
    if (!isComplete) {
      // Small delay to let the app render first
      setTimeout(() => setShowWelcome(true), 500);
    }
  }, []);

  const handleCloseWelcome = () => {
    setShowWelcome(false);
  };

  return (
    <Router>
      {showWelcome && <WelcomeModal onClose={handleCloseWelcome} />}
      <Routes>
        <Route path="/" element={<Layout><TeamBuilder /></Layout>} />
        <Route path="/predictions" element={<Layout><Predictions /></Layout>} />
        <Route path="/history" element={<Layout><TeamHistory /></Layout>} />
        <Route path="/prices" element={<Layout><PriceManager /></Layout>} />
        <Route path="/live-pricing" element={<Layout><LivePricingGuide /></Layout>} />
        <Route path="/rules" element={<Layout><Rules /></Layout>} />
      </Routes>
    </Router>
  );
}

export default App;
