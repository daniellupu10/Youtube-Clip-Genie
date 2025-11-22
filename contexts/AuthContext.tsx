import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User as AppUser, UserPlan } from '../types';
import { supabase, getUserFriendlyError } from '../services/supabaseClient';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export const PLAN_LIMITS = {
  free: {
    videos: 3,
    videoDuration: 60, // minutes (1 hour)
  },
  casual: {
    videos: 15,
    videoDuration: 180, // minutes (3 hours)
  },
  mastermind: {
    videos: 35,
    videoDuration: 480, // minutes (8 hours)
  }
}

interface AuthContextType {
  user: AppUser;
  supabaseUser: SupabaseUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
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

      // Add 3-second timeout to prevent hanging on database queries
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Database query timeout')), 3000);
      });

      // Load user plan with timeout
      const planPromise = supabase
        .from('user_plans')
        .select('plan')
        .eq('user_id', supaUser.id)
        .single();

      const { data: planData, error: planError } = await Promise.race([planPromise, timeoutPromise])
        .catch(err => {
          console.warn('Plan query timed out or failed:', err.message);
          return { data: null, error: err };
        });

      if (planError && planError.code !== 'PGRST116') { // PGRST116 = no rows
        console.error('Error loading user plan:', planError);
      }

      // Load user usage for current month with timeout
      const usagePromise = supabase
        .from('user_usage')
        .select('videos_processed, minutes_processed')
        .eq('user_id', supaUser.id)
        .eq('month', currentMonth)
        .single();

      const { data: usageData, error: usageError } = await Promise.race([usagePromise, timeoutPromise])
        .catch(err => {
          console.warn('Usage query timed out or failed:', err.message);
          return { data: null, error: err };
        });

      if (usageError && usageError.code !== 'PGRST116') {
        console.error('Error loading user usage:', usageError);
      }

      // Get user metadata (name from signup or email)
      const userName = supaUser.user_metadata?.name ||
                       supaUser.user_metadata?.full_name ||
                       supaUser.email?.split('@')[0] ||
                       'User';

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
      console.error('Error loading user data:', error);
      // Still set user as logged in with defaults
      setUser({
        loggedIn: true,
        name: supaUser.user_metadata?.name || supaUser.email?.split('@')[0] || 'User',
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
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setSupabaseUser(session.user);
        await loadUserData(session.user);
      } else {
        setUser(getDefaultUser());
        setSupabaseUser(null);
      }
      setLoading(false);
    }).catch(err => {
      console.error('Error checking session:', err);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event);

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
        console.error('Signup error:', error);
        return { success: false, error: getUserFriendlyError(error.message) };
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

      return { success: false, error: getUserFriendlyError('Unknown error during signup') };
    } catch (error) {
      console.error('Signup exception:', error);
      return { success: false, error: getUserFriendlyError(String(error)) };
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error);
        return { success: false, error: getUserFriendlyError(error.message) };
      }

      return { success: true };
    } catch (error) {
      console.error('Login exception:', error);
      return { success: false, error: getUserFriendlyError(String(error)) };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(getDefaultUser());
      setSupabaseUser(null);
      console.log('User logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
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
        console.error('Error upgrading plan:', error);
        return;
      }

      // Update local state
      setUser(prevUser => ({
        ...prevUser,
        plan: newPlan,
      }));
      console.log(`Successfully upgraded to ${newPlan} plan`);
    } catch (error) {
      console.error('Upgrade exception:', error);
    }
  };

  const recordUsage = async (minutes: number) => {
    if (!supabaseUser) return;

    // ADMIN CHECK: Admins have unlimited usage, don't increment counters
    const ADMIN_EMAIL = 'your-admin-email@example.com'; // ← CHANGE THIS TO YOUR EMAIL
    if (supabaseUser.email === ADMIN_EMAIL) {
      console.log('👑 Admin user - unlimited usage, not recording');
      return;
    }

    const currentMonth = new Date().toISOString().slice(0, 7);

    // OPTIMISTIC UPDATE: Update local state FIRST so counter works immediately
    // This ensures the UI updates even if database operation fails
    setUser(prevUser => ({
      ...prevUser,
      usage: {
        ...prevUser.usage,
        videosProcessed: prevUser.usage.videosProcessed + 1,
        minutesProcessed: prevUser.usage.minutesProcessed + minutes,
      },
    }));

    // Then attempt to persist to database (but don't revert if it fails)
    try {
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
        console.warn('⚠️ Could not save usage to database (tables may not exist):', error.message);
        console.warn('📝 Usage tracking will continue in-memory but won\'t persist across sessions');
      } else {
        console.log('✅ Usage recorded successfully');
      }
    } catch (error) {
      console.warn('⚠️ Database error while recording usage:', error);
      console.warn('📝 Counter will still work but won\'t persist to database');
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      supabaseUser,
      loading,
      login,
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
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
