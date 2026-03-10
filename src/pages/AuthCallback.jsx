import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Handles post-auth redirects from Supabase:
 * - Password reset: detected via the PASSWORD_RECOVERY event in AuthContext
 *   (isRecoveryMode = true). Shows a "set new password" form.
 * - Any other redirect: sends the user home.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const { isRecoveryMode, updatePassword } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // If not a recovery flow, redirect home after Supabase processes the session
  useEffect(() => {
    if (isRecoveryMode) return;
    const timer = setTimeout(() => navigate('/', { replace: true }), 1500);
    return () => clearTimeout(timer);
  }, [isRecoveryMode, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const { error: err } = await updatePassword(password);
    setLoading(false);

    if (err) {
      setError(err.message);
    } else {
      setDone(true);
      setTimeout(() => navigate('/', { replace: true }), 2000);
    }
  };

  if (!isRecoveryMode) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-f1-red border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Completing sign in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-f1-red to-f1-red-dark flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center text-white">
        <h1 className="text-4xl font-bold">Fantasy F1</h1>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Set new password</h2>
        <p className="text-sm text-gray-500 mb-6">Choose a new password for your account.</p>

        {done ? (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm text-center">
            Password updated! Redirecting…
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-f1-red focus:border-transparent"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-f1-red focus:border-transparent"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-f1-red text-white rounded-lg font-medium text-sm hover:bg-f1-red-dark transition-colors disabled:opacity-50"
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
