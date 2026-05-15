import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  WrenchScrewdriverIcon,
  SparklesIcon,
  ClockIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import CacheStatus from '../components/ui/CacheStatus';
import AuthButton from '../components/ui/AuthButton';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { path: '/', label: 'Team', Icon: WrenchScrewdriverIcon },
  { path: '/predictions', label: 'AI Picks', Icon: SparklesIcon },
  { path: '/history', label: 'History', Icon: ClockIcon },
  { path: '/prices', label: 'Prices', Icon: CurrencyDollarIcon },
  { path: '/rules', label: 'Rules', Icon: DocumentTextIcon },
];

const Layout = ({ children }) => {
  const location = useLocation();
  const { theme, setTheme, user, signOut, supabaseReady } = useAuth();

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <div className="flex h-[100dvh] bg-gray-50 dark:bg-f1-black font-f1 overflow-hidden">

      {/* ── Desktop Sidebar ────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-56 bg-[#0F0F13] border-r border-f1-border flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-6 border-b border-f1-border">
          <div className="w-[3px] h-8 bg-f1-red rounded-full flex-shrink-0" />
          <div>
            <h1 className="text-lg font-black text-white uppercase tracking-tight leading-none">
              Fantasy F1
            </h1>
            <p className="text-[10px] text-f1-muted tracking-[0.2em] uppercase mt-0.5">
              Team Builder
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ path, label, Icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  active
                    ? 'bg-f1-red text-white shadow-lg shadow-f1-red/20'
                    : 'text-f1-muted hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="p-4 border-t border-f1-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-f1-muted">$100M · 5D + 2C</span>
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-sm"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
          <AuthButton />
        </div>
      </aside>

      {/* ── Right column (mobile header + content) ────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Mobile Header */}
        <header className="md:hidden flex items-center h-14 px-4 gap-3 bg-[#0F0F13] border-b border-f1-border flex-shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-[3px] h-6 bg-f1-red rounded-full flex-shrink-0" />
            <span className="text-white font-black text-base uppercase tracking-tight truncate">
              Fantasy F1
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 text-sm"
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            {supabaseReady && (
              user ? (
                <button
                  onClick={signOut}
                  className="w-8 h-8 rounded-full bg-f1-red flex items-center justify-center text-white font-black text-xs"
                  title={`Signed in as ${user.email} – tap to sign out`}
                >
                  {(user.email?.[0] ?? '?').toUpperCase()}
                </button>
              ) : (
                <Link
                  to="/login"
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-f1-muted hover:text-white transition-colors"
                  title="Sign in"
                >
                  <UserCircleIcon className="w-5 h-5" />
                </Link>
              )
            )}
          </div>
        </header>

        {/* Scrollable page content — pb-16 clears the mobile bottom nav */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {children}
        </main>

      </div>

      {/* ── Mobile Bottom Tab Bar ──────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-[#0F0F13] border-t border-f1-border flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {navItems.map(({ path, label, Icon }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={`relative flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors min-h-touch ${
                active ? 'text-f1-red' : 'text-f1-muted'
              }`}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-f1-red rounded-b-full" />
              )}
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-bold uppercase tracking-wide">{label}</span>
            </Link>
          );
        })}
      </nav>

      <CacheStatus />
    </div>
  );
};

export default Layout;
