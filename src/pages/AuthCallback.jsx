import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Handles the OAuth redirect from Supabase.
 * The Supabase JS client automatically exchanges the code in the URL
 * for a session via onAuthStateChange. We just show a loading screen
 * and redirect home once done.
 */
export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Give the Supabase client a moment to process the session from the URL,
    // then redirect to the home page.
    const timer = setTimeout(() => navigate('/', { replace: true }), 1500);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-f1-red border-t-transparent mx-auto mb-4"></div>
        <p className="text-gray-600 font-medium">Completing sign in...</p>
      </div>
    </div>
  );
}
