import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const AuthContext = createContext(null);

const LS_KEYS = {
  currentTeam: 'fantasy_f1_current_team',
  customPrices: 'fantasy_f1_custom_prices',
  teamHistory: 'fantasy_f1_teams_history',
  priceHistory: 'fantasy_f1_price_history',
};

export function AuthProvider({ children }) {
  const [supabase, setSupabase] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle' | 'syncing' | 'synced' | 'error'
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

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
        .select('current_team, custom_prices, team_history, price_history')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows

      if (data) {
        if (data.current_team) localStorage.setItem(LS_KEYS.currentTeam, JSON.stringify(data.current_team));
        if (data.custom_prices) localStorage.setItem(LS_KEYS.customPrices, JSON.stringify(data.custom_prices));
        if (data.team_history) localStorage.setItem(LS_KEYS.teamHistory, JSON.stringify(data.team_history));
        if (data.price_history) localStorage.setItem(LS_KEYS.priceHistory, JSON.stringify(data.price_history));
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

    const interval = setInterval(syncToCloud, 60_000);
    return () => clearInterval(interval);
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

  return (
    <AuthContext.Provider value={{
      user, authLoading, syncStatus, isRecoveryMode,
      signIn, signUp, signOut, resetPassword, updatePassword,
      syncToCloud, supabaseReady: !!supabase,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
