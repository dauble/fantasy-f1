import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const AuthContext = createContext(null);

const LS_KEYS = {
  currentTeam: 'fantasy_f1_current_team',
  customPrices: 'fantasy_f1_custom_prices',
  teamHistory: 'fantasy_f1_teams_history',
  priceHistory: 'fantasy_f1_price_history',
  aiPrediction: 'fantasy_f1_ai_prediction',
};

export function AuthProvider({ children }) {
  const [supabase, setSupabase] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle' | 'syncing' | 'synced' | 'error'
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  // ─── Theme ────────────────────────────────────────────────────────────────
  const [theme, setThemeState] = useState(
    () => localStorage.getItem('fantasy_f1_theme') ?? 'light'
  );

  // Apply / remove the `dark` class on <html> whenever theme changes
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const setTheme = useCallback(async (newTheme) => {
    setThemeState(newTheme);
    localStorage.setItem('fantasy_f1_theme', newTheme);
    // Persist to Supabase user metadata when logged in
    if (supabase && user) {
      supabase.auth.updateUser({ data: { theme: newTheme } }).catch((e) =>
        console.warn('[theme] Failed to save theme to profile:', e.message)
      );
    }
  }, [supabase, user]);

  // When a user logs in, pull their saved theme from user_metadata
  useEffect(() => {
    const cloudTheme = user?.user_metadata?.theme;
    if (cloudTheme && (cloudTheme === 'dark' || cloudTheme === 'light')) {
      setThemeState(cloudTheme);
      localStorage.setItem('fantasy_f1_theme', cloudTheme);
    }
  }, [user]);

  // Initialize Supabase from runtime config
  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then(({ supabaseUrl, supabaseAnonKey }) => {
        if (!supabaseUrl || !supabaseAnonKey) {
          setAuthLoading(false);
          return;
        }

        const client = createClient(supabaseUrl, supabaseAnonKey);
        setSupabase(client);

        client.auth.getSession().then(({ data: { session } }) => {
          setUser(session?.user ?? null);
          setAuthLoading(false);
        });

        const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
          setUser(session?.user ?? null);
          if (event === 'PASSWORD_RECOVERY') {
            setIsRecoveryMode(true);
          }
        });

        return () => subscription.unsubscribe();
      })
      .catch(() => {
        setAuthLoading(false);
      });
  }, []);

  // Pull data from Supabase into localStorage on login
  const pullFromCloud = useCallback(async (client, userId) => {
    setSyncStatus('syncing');
    try {
      const { data, error } = await client
        .from('user_data')
        .select('current_team, custom_prices, team_history, price_history, ai_prediction')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows

      if (data) {
        if (data.current_team) localStorage.setItem(LS_KEYS.currentTeam, JSON.stringify(data.current_team));
        if (data.custom_prices) localStorage.setItem(LS_KEYS.customPrices, JSON.stringify(data.custom_prices));
        if (data.team_history) localStorage.setItem(LS_KEYS.teamHistory, JSON.stringify(data.team_history));
        if (data.price_history) localStorage.setItem(LS_KEYS.priceHistory, JSON.stringify(data.price_history));
        if (data.ai_prediction) localStorage.setItem(LS_KEYS.aiPrediction, JSON.stringify(data.ai_prediction));
      }

      setSyncStatus('synced');
    } catch (err) {
      console.error('Error pulling from cloud:', err);
      setSyncStatus('error');
    }
  }, []);

  // Push localStorage data up to Supabase
  const syncToCloud = useCallback(async () => {
    if (!supabase || !user) return;
    setSyncStatus('syncing');
    try {
      const parse = (key) => {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      };

      const { error } = await supabase.from('user_data').upsert({
        id: user.id,
        current_team: parse(LS_KEYS.currentTeam),
        custom_prices: parse(LS_KEYS.customPrices),
        team_history: parse(LS_KEYS.teamHistory),
        price_history: parse(LS_KEYS.priceHistory),
        ai_prediction: parse(LS_KEYS.aiPrediction),
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
      setSyncStatus('synced');
    } catch (err) {
      console.error('Error syncing to cloud:', err);
      setSyncStatus('error');
    }
  }, [supabase, user]);

  // Auto-pull when user logs in, auto-sync every 60s while logged in
  useEffect(() => {
    if (!supabase || !user) return;

    pullFromCloud(supabase, user.id);

    // Push every 60s
    const pushInterval = setInterval(syncToCloud, 60_000);

    // Pull from cloud when the tab becomes visible again after being hidden
    // (handles the "just came from another device" scenario)
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
      } else if (document.visibilityState === 'visible' && Date.now() - hiddenAt > 5 * 60 * 1000) {
        pullFromCloud(supabase, user.id);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(pushInterval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [supabase, user, pullFromCloud, syncToCloud]);

  const signIn = useCallback(async (email, password) => {
    if (!supabase) return { error: { message: 'Auth not available' } };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, [supabase]);

  const signUp = useCallback(async (email, password) => {
    if (!supabase) return { error: { message: 'Auth not available' } };
    const { data, error } = await supabase.auth.signUp({ email, password });
    // needsEmailConfirmation is true when Supabase hasn't auto-confirmed the user
    const needsEmailConfirmation = !error && !data.session;
    return { error, needsEmailConfirmation };
  }, [supabase]);

  const resetPassword = useCallback(async (email) => {
    if (!supabase) return { error: { message: 'Auth not available' } };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    return { error };
  }, [supabase]);

  const updatePassword = useCallback(async (password) => {
    if (!supabase) return { error: { message: 'Auth not available' } };
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) setIsRecoveryMode(false);
    return { error };
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setSyncStatus('idle');
  }, [supabase]);

  // Bidirectional sync: pull cloud data into local, then push local back up.
  // This ensures Device B picks up changes made on Device A.
  const syncBidirectional = useCallback(async () => {
    if (!supabase || !user) return;
    await pullFromCloud(supabase, user.id);
    await syncToCloud();
  }, [supabase, user, pullFromCloud, syncToCloud]);

  // Exposed pull-only helper (used by manual "Pull from cloud" action)
  const pullNow = useCallback(() => {
    if (!supabase || !user) return Promise.resolve();
    return pullFromCloud(supabase, user.id);
  }, [supabase, user, pullFromCloud]);

  return (
    <AuthContext.Provider value={{
      user, authLoading, syncStatus, isRecoveryMode,
      theme, setTheme,
      signIn, signUp, signOut, resetPassword, updatePassword,
      syncToCloud, syncBidirectional, pullNow, supabaseReady: !!supabase,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
