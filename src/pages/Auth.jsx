import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const MODES = { SIGNIN: 'signin', SIGNUP: 'signup', FORGOT: 'forgot' };

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp, resetPassword, supabaseReady } = useAuth();

  const [mode, setMode] = useState(MODES.SIGNIN);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const clearMessages = () => { setError(''); setSuccessMessage(''); };

  const switchMode = (newMode) => {
    clearMessages();
    setPassword('');
    setConfirmPassword('');
    setMode(newMode);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearMessages();

    if (mode === MODES.SIGNUP && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (mode === MODES.SIGNUP && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    if (mode === MODES.SIGNIN) {
      const { error: err } = await signIn(email, password);
      if (err) {
        setError(err.message);
      } else {
        navigate('/', { replace: true });
      }
    }

    if (mode === MODES.SIGNUP) {
      const { error: err, needsEmailConfirmation } = await signUp(email, password);
      if (err) {
        setError(err.message);
      } else if (needsEmailConfirmation) {
        setSuccessMessage('Account created! Check your email to confirm your address before signing in.');
      } else {
        navigate('/', { replace: true });
      }
    }

    if (mode === MODES.FORGOT) {
      const { error: err } = await resetPassword(email);
      if (err) {
        setError(err.message);
      } else {
        setSuccessMessage('Password reset email sent. Check your inbox.');
      }
    }

    setLoading(false);
  };

  const titles = {
    [MODES.SIGNIN]: 'Sign in',
    [MODES.SIGNUP]: 'Create account',
    [MODES.FORGOT]: 'Reset password',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-f1-red to-f1-red-dark flex flex-col items-center justify-center p-4">
      {/* Branding */}
      <div className="mb-8 text-center text-white">
        <h1 className="text-4xl font-bold">Fantasy F1</h1>
        <p className="text-white text-opacity-75 mt-1">Team Builder</p>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">
        <h2 className="text-xl font-bold text-gray-800 mb-6">{titles[mode]}</h2>

        {!supabaseReady && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
            Authentication is not configured yet.
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-f1-red focus:border-transparent"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          {mode !== MODES.FORGOT && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-f1-red focus:border-transparent"
                placeholder="••••••••"
                autoComplete={mode === MODES.SIGNUP ? 'new-password' : 'current-password'}
              />
            </div>
          )}

          {mode === MODES.SIGNUP && (
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
          )}

          <button
            type="submit"
            disabled={loading || !supabaseReady}
            className="w-full py-2.5 bg-f1-red text-white rounded-lg font-medium text-sm hover:bg-f1-red-dark transition-colors disabled:opacity-50"
          >
            {loading ? 'Please wait…' : titles[mode]}
          </button>
        </form>

        {/* Mode switchers */}
        <div className="mt-5 space-y-2 text-center text-sm text-gray-500">
          {mode === MODES.SIGNIN && (
            <>
              <p>
                <button onClick={() => switchMode(MODES.FORGOT)} className="text-f1-red hover:underline">
                  Forgot your password?
                </button>
              </p>
              <p>
                No account?{' '}
                <button onClick={() => switchMode(MODES.SIGNUP)} className="text-f1-red font-medium hover:underline">
                  Create one
                </button>
              </p>
            </>
          )}
          {mode === MODES.SIGNUP && (
            <p>
              Already have an account?{' '}
              <button onClick={() => switchMode(MODES.SIGNIN)} className="text-f1-red font-medium hover:underline">
                Sign in
              </button>
            </p>
          )}
          {mode === MODES.FORGOT && (
            <p>
              <button onClick={() => switchMode(MODES.SIGNIN)} className="text-f1-red hover:underline">
                Back to sign in
              </button>
            </p>
          )}
        </div>

        <div className="mt-5 pt-4 border-t border-gray-100 text-center">
          <Link to="/" className="text-sm text-gray-400 hover:text-gray-600">
            Continue without signing in
          </Link>
        </div>
      </div>
    </div>
  );
}
