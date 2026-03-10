import React from 'react';
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
  const { user, authLoading, syncStatus, signIn, signOut, syncToCloud, supabaseReady } = useAuth();

  // Don't render anything if Supabase isn't configured
  if (!supabaseReady) return null;

  if (authLoading) {
    return (
      <div className="px-4 py-3 text-white text-opacity-50 text-sm">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <button
        onClick={signIn}
        className="w-full flex items-center gap-2 px-4 py-3 rounded-lg bg-white bg-opacity-10 hover:bg-opacity-20 transition-all text-white text-sm font-medium"
      >
        <GoogleIcon />
        Sign in with Google
      </button>
    );
  }

  const syncLabel = SYNC_LABELS[syncStatus];
  const syncColor = SYNC_COLORS[syncStatus];

  return (
    <div className="space-y-2">
      {/* User info */}
      <div className="flex items-center gap-2 px-1">
        {user.user_metadata?.avatar_url ? (
          <img
            src={user.user_metadata.avatar_url}
            alt="Avatar"
            className="w-7 h-7 rounded-full flex-shrink-0"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-white bg-opacity-20 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {(user.email?.[0] ?? '?').toUpperCase()}
          </div>
        )}
        <span className="text-white text-sm truncate flex-1" title={user.email}>
          {user.user_metadata?.full_name || user.email}
        </span>
      </div>

      {/* Sync status */}
      {syncLabel && (
        <p className={`text-xs px-1 ${syncColor}`}>{syncLabel}</p>
      )}

      {/* Actions */}
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

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
      <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
