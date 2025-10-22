import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User, UserPlan } from '../types';

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

const getInitialUser = (): User => {
  try {
    const item = window.localStorage.getItem('user');
    if (item) {
        const user = JSON.parse(item);
        // Basic validation
        if (user && typeof user.loggedIn === 'boolean' && user.usage) {
             // Check if we need to reset usage
            const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
            if (user.usage.lastReset !== currentMonth) {
                user.usage = {
                    videosProcessed: 0,
                    minutesProcessed: 0,
                    lastReset: currentMonth,
                };
            }
            return user;
        }
    }
  } catch (error) {
    console.error("Error reading user from localStorage", error);
  }
  
  return {
    loggedIn: false,
    name: '',
    email: '',
    plan: 'free',
    usage: {
      videosProcessed: 0,
      minutesProcessed: 0,
      lastReset: new Date().toISOString().slice(0, 7), // YYYY-MM
    }
  };
};

interface AuthContextType {
  user: User;
  login: (email: string, password?: string) => void;
  logout: () => void;
  upgrade: (plan: 'casual' | 'mastermind') => void;
  recordUsage: (minutes: number) => void;
  signup: (name: string, email: string, password?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(getInitialUser);

  useEffect(() => {
    try {
      window.localStorage.setItem('user', JSON.stringify(user));
    } catch (error) {
      console.error("Error saving user to localStorage", error);
    }
  }, [user]);

  const login = (email: string, password?: string) => {
    setUser(prevUser => {
        const currentMonth = new Date().toISOString().slice(0, 7);
         if (prevUser.usage.lastReset !== currentMonth) {
            return { 
                ...prevUser, 
                loggedIn: true, 
                name: email.split('@')[0], // Mock name from email
                email,
                usage: { videosProcessed: 0, minutesProcessed: 0, lastReset: currentMonth }
            };
        }
        return { 
            ...prevUser, 
            loggedIn: true,
            name: email.split('@')[0], // Mock name from email
            email,
        };
    });
  };

  const signup = (name: string, email: string, password?: string) => {
    setUser({
        loggedIn: true,
        name,
        email,
        plan: 'free',
        usage: {
            videosProcessed: 0,
            minutesProcessed: 0,
            lastReset: new Date().toISOString().slice(0, 7),
        }
    });
  }

  const logout = () => {
    // BUG FIX: Do NOT clear clips on logout. The user's clips should persist
    // for when they log back in. The UI will clear automatically based on
    // the `loggedIn` state change.
    setUser(prevUser => ({
      ...prevUser,
      loggedIn: false,
      // We don't clear name/email so the login form can be pre-filled later if desired
    }));
  };

  const upgrade = (newPlan: 'casual' | 'mastermind') => {
    setUser(prevUser => ({
      ...prevUser,
      plan: newPlan,
    }));
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
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, upgrade, recordUsage, signup }}>
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
