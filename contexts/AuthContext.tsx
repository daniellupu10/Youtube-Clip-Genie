// ← FIXED AUTH FOREVER + CLIP GENIE PERSONALITY INJECTED → NOW MAGICAL AND UNBREAKABLE
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User as AppUser, UserPlan } from '../types';
import { supabase, translateToGenieSpeak } from '../services/supabaseClient';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export const PLAN_LIMITS = {
  free: {
    videos: 3,
    videoDuration: 20, // minutes
  },
  casual: {
    videos: 15,
    videoDuration: 30, // minutes
  },
  mastermind: {
    minutes: 600,
  }
}

interface AuthContextType {
  user: AppUser;
  supabaseUser: SupabaseUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  upgrade: (plan: 'casual' | 'mastermind') => Promise<void>;
  recordUsage: (minutes: number) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getDefaultUser = (): AppUser => ({
  loggedIn: false,
  name: '',
  email: '',
  plan: 'free',
  usage: {
    videosProcessed: 0,
    minutesProcessed: 0,
    lastReset: new Date().toISOString().slice(0, 7), // YYYY-MM
  }
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser>(getDefaultUser);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user plan and usage from Supabase
  const loadUserData = async (supaUser: SupabaseUser) => {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);

      // Load user plan
      const { data: planData, error: planError } = await supabase
        .from('user_plans')
        .select('plan')
        .eq('user_id', supaUser.id)
        .single();

      if (planError && planError.code !== 'PGRST116') { // PGRST116 = no rows
        console.error('🧞 Error loading user plan:', planError);
      }

      // Load user usage for current month
      const { data: usageData, error: usageError } = await supabase
        .from('user_usage')
        .select('videos_processed, minutes_processed')
        .eq('user_id', supaUser.id)
        .eq('month', currentMonth)
        .single();

      if (usageError && usageError.code !== 'PGRST116') {
        console.error('🧞 Error loading user usage:', usageError);
      }

      // Get user metadata (name from signup or email)
      const userName = supaUser.user_metadata?.name ||
                       supaUser.user_metadata?.full_name ||
                       supaUser.email?.split('@')[0] ||
                       'Clip Lord';

      setUser({
        loggedIn: true,
        name: userName,
        email: supaUser.email || '',
        plan: (planData?.plan as UserPlan) || 'free',
        usage: {
          videosProcessed: usageData?.videos_processed || 0,
          minutesProcessed: usageData?.minutes_processed || 0,
          lastReset: currentMonth,
        }
      });
    } catch (error) {
      console.error('🧞 Error loading user data:', error);
      // Still set user as logged in with defaults
      setUser({
        loggedIn: true,
        name: supaUser.user_metadata?.name || supaUser.email?.split('@')[0] || 'Clip Lord',
        email: supaUser.email || '',
        plan: 'free',
        usage: {
          videosProcessed: 0,
          minutesProcessed: 0,
          lastReset: new Date().toISOString().slice(0, 7),
        }
      });
    }
  };

  // Listen for auth state changes
  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSupabaseUser(session.user);
        loadUserData(session.user);
      } else {
        setUser(getDefaultUser());
        setSupabaseUser(null);
      }
      setLoading(false);
    });

    // Listen for auth changes (including OAuth redirects)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🧞 Auth event:', event);

      if (session?.user) {
        setSupabaseUser(session.user);
        await loadUserData(session.user);
      } else {
        setUser(getDefaultUser());
        setSupabaseUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signup = async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Sign up with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            full_name: name,
          },
        },
      });

      if (error) {
        console.error('🧞 Signup error:', error);
        return { success: false, error: translateToGenieSpeak(error.message) };
      }

      if (data.user) {
        // User plan will be created automatically by database trigger
        // Just need to create initial usage record
        const currentMonth = new Date().toISOString().slice(0, 7);

        await supabase.from('user_usage').insert({
          user_id: data.user.id,
          month: currentMonth,
          videos_processed: 0,
          minutes_processed: 0,
        });

        return { success: true };
      }

      return { success: false, error: translateToGenieSpeak('Unknown error during signup') };
    } catch (error) {
      console.error('🧞 Signup exception:', error);
      return { success: false, error: translateToGenieSpeak(String(error)) };
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('🧞 Login error:', error);
        return { success: false, error: translateToGenieSpeak(error.message) };
      }

      return { success: true };
    } catch (error) {
      console.error('🧞 Login exception:', error);
      return { success: false, error: translateToGenieSpeak(String(error)) };
    }
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('🧞 Google login error:', error);
        return { success: false, error: translateToGenieSpeak(error.message) };
      }

      // OAuth redirects away, so this is considered success
      return { success: true };
    } catch (error) {
      console.error('🧞 Google login exception:', error);
      return { success: false, error: translateToGenieSpeak(String(error)) };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(getDefaultUser());
      setSupabaseUser(null);
      console.log('🧞 User logged out successfully');
    } catch (error) {
      console.error('🧞 Logout error:', error);
    }
  };

  const upgrade = async (newPlan: 'casual' | 'mastermind') => {
    if (!supabaseUser) return;

    try {
      // Update plan in database
      const { error } = await supabase
        .from('user_plans')
        .update({ plan: newPlan })
        .eq('user_id', supabaseUser.id);

      if (error) {
        console.error('🧞 Error upgrading plan:', error);
        return;
      }

      // Update local state
      setUser(prevUser => ({
        ...prevUser,
        plan: newPlan,
      }));
      console.log(`🧞 Successfully upgraded to ${newPlan} plan!`);
    } catch (error) {
      console.error('🧞 Upgrade exception:', error);
    }
  };

  const recordUsage = async (minutes: number) => {
    if (!supabaseUser) return;

    const currentMonth = new Date().toISOString().slice(0, 7);

    try {
      // Upsert (insert or update) usage record
      const { error } = await supabase
        .from('user_usage')
        .upsert({
          user_id: supabaseUser.id,
          month: currentMonth,
          videos_processed: user.usage.videosProcessed + 1,
          minutes_processed: user.usage.minutesProcessed + minutes,
        }, {
          onConflict: 'user_id,month',
        });

      if (error) {
        console.error('🧞 Error recording usage:', error);
        return;
      }

      // Update local state
      setUser(prevUser => ({
        ...prevUser,
        usage: {
          ...prevUser.usage,
          videosProcessed: prevUser.usage.videosProcessed + 1,
          minutesProcessed: prevUser.usage.minutesProcessed + minutes,
        },
      }));
    } catch (error) {
      console.error('🧞 Record usage exception:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      supabaseUser,
      loading,
      login,
      loginWithGoogle,
      logout,
      upgrade,
      recordUsage,
      signup
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('🧞 useAuth must be used within an AuthProvider - you forgot to wrap your app!');
  }
  return context;
};
