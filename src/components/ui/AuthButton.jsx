import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const SYNC_LABELS = {
  idle: null,
  syncing: 'Syncing...',
  synced: 'Synced',
  error: 'Sync failed',
};

const SYNC_COLORS = {
  idle: '',
  syncing: 'text-yellow-300',
  synced: 'text-green-300',
  error: 'text-red-300',
};

export default function AuthButton() {
  const { user, authLoading, syncStatus, signOut, syncToCloud, supabaseReady } = useAuth();

  if (!supabaseReady) return null;

  if (authLoading) {
    return <div className="text-white text-opacity-50 text-sm px-1">Loading...</div>;
  }

  if (!user) {
    return (
      <Link
        to="/login"
        className="block w-full text-center px-4 py-2.5 rounded-lg bg-white bg-opacity-10 hover:bg-opacity-20 transition-all text-white text-sm font-medium"
      >
        Sign in / Create account
      </Link>
    );
  }

  const syncLabel = SYNC_LABELS[syncStatus];
  const syncColor = SYNC_COLORS[syncStatus];

  return (
    <div className="space-y-2">
      {/* User info */}
      <div className="flex items-center gap-2 px-1">
        <div className="w-7 h-7 rounded-full bg-white bg-opacity-20 flex items-center justify-center text-xs font-bold flex-shrink-0">
          {(user.email?.[0] ?? '?').toUpperCase()}
        </div>
        <span className="text-white text-sm truncate flex-1" title={user.email}>
          {user.email}
        </span>
      </div>

      {syncLabel && (
        <p className={`text-xs px-1 ${syncColor}`}>{syncLabel}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={syncToCloud}
          disabled={syncStatus === 'syncing'}
          className="flex-1 px-3 py-2 rounded-lg bg-white bg-opacity-10 hover:bg-opacity-20 transition-all text-white text-xs font-medium disabled:opacity-50"
        >
          {syncStatus === 'syncing' ? 'Syncing…' : 'Sync now'}
        </button>
        <button
          onClick={signOut}
          className="px-3 py-2 rounded-lg bg-white bg-opacity-10 hover:bg-opacity-20 transition-all text-white text-xs font-medium"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
