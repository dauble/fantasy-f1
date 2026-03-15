import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import CacheStatus from '../components/ui/CacheStatus';
import AuthButton from '../components/ui/AuthButton';
import { useAuth } from '../context/AuthContext';

const Layout = ({ children }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const { theme, setTheme } = useAuth();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const navItems = [
    { path: '/', label: '🏎️ Team Builder', icon: '🏎️' },
    { path: '/predictions', label: '📊 Predictions', icon: '📊' },
    { path: '/history', label: '📜 Team History', icon: '📜' },
    { path: '/prices', label: '💰 Price Manager', icon: '💰' },
    { path: '/rules', label: '📋 Rules', icon: '📋' },
  ];

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-950">
      {/* Sidebar */}
      <aside className={`fixed inset-0 z-50 w-64 bg-gradient-to-b from-f1-red to-f1-red-dark text-white shadow-2xl overflow-y-auto transform ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:relative md:w-64 transition-transform duration-300 ease-in-out`}>
        {/* Mobile Header */}
        <div className="p-4 flex justify-between items-center border-b border-white border-opacity-20 md:hidden">
          <h1 className="text-xl font-bold">Fantasy F1</h1>
          <button 
            onClick={toggleMenu} 
            className="text-white focus:outline-none p-2 hover:bg-white hover:bg-opacity-10 rounded-lg transition-colors min-h-touch min-w-touch"
            aria-label="Close menu"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        {/* Desktop Logo */}
        <div className="p-6 border-b border-white border-opacity-20 hidden md:block">
          <h1 className="text-2xl font-bold text-center">Fantasy F1</h1>
          <p className="text-sm text-center text-white text-opacity-75 mt-1">Team Builder</p>
        </div>
        
        {/* Navigation */}
        <nav className="p-4">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`block px-4 py-3 rounded-lg transition-all min-h-touch ${
                    location.pathname === item.path 
                      ? 'bg-white text-f1-red font-semibold shadow-lg' 
                      : 'hover:bg-white hover:bg-opacity-10'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer Info */}
        <div className="p-4 mt-auto border-t border-white border-opacity-20 space-y-4">
          <div className="flex items-center justify-between text-sm text-white text-opacity-75">
            <div className="space-y-1">
              <p>Budget: $100M</p>
              <p>5 Drivers + 2 Constructors</p>
            </div>
            {/* Dark / light mode toggle */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-lg bg-white bg-opacity-10 hover:bg-opacity-20 transition-colors text-base leading-none"
              aria-label="Toggle dark mode"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
          <AuthButton />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="bg-gradient-to-r from-f1-red to-f1-red-dark text-white p-4 flex justify-between items-center md:hidden shadow-lg">
          <button 
            onClick={toggleMenu} 
            className="focus:outline-none p-2 hover:bg-white hover:bg-opacity-10 rounded-lg transition-colors min-h-touch min-w-touch"
            aria-label="Open menu"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold">Fantasy F1</h1>
          <div className="w-10"></div>
        </header>
        
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-900">
          {children}
        </main>
      </div>

      {/* Mobile Overlay */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={toggleMenu}
        ></div>
      )}
      
      {/* Cache Status Widget */}
      <CacheStatus />
    </div>
  );
};

export default Layout;
