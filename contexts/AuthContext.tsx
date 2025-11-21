import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User as AppUser, UserPlan } from '../types';
import { supabase, getUserFriendlyError } from '../services/supabaseClient';
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
  logout: () => Promise<void>;
  upgrade: (plan: 'casual' | 'mastermind') => void;
  recordUsage: (minutes: number) => void;
  signup: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Get user data from localStorage
const getStoredUserData = (email: string): { plan: UserPlan; usage: AppUser['usage'] } => {
  try {
    const stored = localStorage.getItem(`user_data_${email}`);
    if (stored) {
      const data = JSON.parse(stored);
      // Check if we need to reset usage for new month
      const currentMonth = new Date().toISOString().slice(0, 7);
      if (data.usage?.lastReset !== currentMonth) {
        return {
          plan: data.plan || 'free',
          usage: {
            videosProcessed: 0,
            minutesProcessed: 0,
            lastReset: currentMonth,
          }
        };
      }
      return data;
    }
  } catch (error) {
    console.error('Error loading user data from localStorage:', error);
  }

  return {
    plan: 'free',
    usage: {
      videosProcessed: 0,
      minutesProcessed: 0,
      lastReset: new Date().toISOString().slice(0, 7),
    }
  };
};

// Save user data to localStorage
const saveUserData = (email: string, plan: UserPlan, usage: AppUser['usage']) => {
  try {
    localStorage.setItem(`user_data_${email}`, JSON.stringify({ plan, usage }));
  } catch (error) {
    console.error('Error saving user data to localStorage:', error);
  }
};

const getDefaultUser = (): AppUser => ({
  loggedIn: false,
  name: '',
  email: '',
  plan: 'free',
  usage: {
    videosProcessed: 0,
    minutesProcessed: 0,
    lastReset: new Date().toISOString().slice(0, 7),
  }
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser>(getDefaultUser);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user data from Supabase auth and localStorage
  const loadUserData = (supaUser: SupabaseUser) => {
    const userName = supaUser.user_metadata?.name ||
                     supaUser.user_metadata?.full_name ||
                     supaUser.email?.split('@')[0] ||
                     'User';

    const email = supaUser.email || '';
    const { plan, usage } = getStoredUserData(email);

    setUser({
      loggedIn: true,
      name: userName,
      email,
      plan,
      usage,
    });

    console.log('✅ User logged in:', userName, '| Plan:', plan);
  };

  // Listen for auth state changes
  useEffect(() => {
    console.log('🔐 Initializing Supabase auth...');

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('📋 Session check:', session ? 'Active session found' : 'No active session');

      if (session?.user) {
        setSupabaseUser(session.user);
        loadUserData(session.user);
      } else {
        setUser(getDefaultUser());
        setSupabaseUser(null);
      }
      setLoading(false);
    }).catch((error) => {
      console.error('❌ Error checking session:', error);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔔 Auth event:', event);

      if (session?.user) {
        setSupabaseUser(session.user);
        loadUserData(session.user);
      } else {
        setUser(getDefaultUser());
        setSupabaseUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Save user data whenever it changes
  useEffect(() => {
    if (user.loggedIn && user.email) {
      saveUserData(user.email, user.plan, user.usage);
    }
  }, [user]);

  const signup = async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('📝 Signing up user:', email);

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
        console.error('❌ Signup error:', error);
        return { success: false, error: getUserFriendlyError(error.message) };
      }

      if (data.user) {
        console.log('✅ Signup successful');
        // Initialize user data in localStorage
        saveUserData(email, 'free', {
          videosProcessed: 0,
          minutesProcessed: 0,
          lastReset: new Date().toISOString().slice(0, 7),
        });
        return { success: true };
      }

      return { success: false, error: getUserFriendlyError('Unknown error during signup') };
    } catch (error) {
      console.error('❌ Signup exception:', error);
      return { success: false, error: getUserFriendlyError(String(error)) };
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('🔑 Logging in user:', email);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Login error:', error);
        return { success: false, error: getUserFriendlyError(error.message) };
      }

      console.log('✅ Login successful');
      return { success: true };
    } catch (error) {
      console.error('❌ Login exception:', error);
      return { success: false, error: getUserFriendlyError(String(error)) };
    }
  };

  const logout = async () => {
    try {
      console.log('👋 Logging out user');
      await supabase.auth.signOut();
      setUser(getDefaultUser());
      setSupabaseUser(null);
      console.log('✅ Logout successful');
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  };

  const upgrade = (newPlan: 'casual' | 'mastermind') => {
    setUser(prevUser => ({
      ...prevUser,
      plan: newPlan,
    }));
    console.log('✅ Upgraded to plan:', newPlan);
  };

  const recordUsage = (minutes: number) => {
    setUser(prevUser => ({
      ...prevUser,
      usage: {
        ...prevUser.usage,
        videosProcessed: prevUser.usage.videosProcessed + 1,
        minutesProcessed: prevUser.usage.minutesProcessed + minutes,
      },
    }));
    console.log('📊 Usage recorded:', minutes, 'minutes');
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
