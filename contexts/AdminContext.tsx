import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from './AuthContext';

// Admin email - YOU can change this to your email
const ADMIN_EMAIL = 'your-admin-email@example.com'; // ← CHANGE THIS TO YOUR EMAIL

interface AdminContextType {
  isAdmin: boolean;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, supabaseUser } = useAuth();

  // Check if current user is admin
  const isAdmin = user.loggedIn && supabaseUser?.email === ADMIN_EMAIL;

  return (
    <AdminContext.Provider value={{ isAdmin }}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};
