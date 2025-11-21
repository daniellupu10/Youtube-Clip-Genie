import { createClient } from '@supabase/supabase-js';

// Supabase project credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://cnxnxfgbfjqakvclcvmn.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNueG54ZmdiZmpxYWt2Y2xjdm1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MTYwNjgsImV4cCI6MjA3ODM5MjA2OH0.8lle8F9krxM-3MgS-_ZrT-1H5a8OTsIjCMmak-lhafU';

// Create single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Auto refresh the session when it expires
    autoRefreshToken: true,
    // Persist auth session in localStorage
    persistSession: true,
    // Detect session changes in other tabs
    detectSessionInUrl: true,
    // Disable email confirmation for simpler signup flow
    flowType: 'pkce',
  },
});

console.log('🔧 Supabase client initialized');
console.log('   URL:', supabaseUrl);
console.log('   Key configured:', !!supabaseAnonKey);

// Database types (TypeScript interfaces for Supabase tables)
export interface UserVideo {
  id: string;
  user_id: string;
  youtube_url: string;
  video_title: string | null;
  created_at: string;
}

export interface ClipRow {
  id: string;
  user_video_id: string;
  start_time: number;
  end_time: number;
  title: string;
  description: string | null;
  tags: string[] | null;
  clip_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
}

// Helper function to get current user
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Error getting current user:', error);
    return null;
  }
  return user;
};

// Helper function to check if user is authenticated
export const isAuthenticated = async () => {
  const user = await getCurrentUser();
  return !!user;
};

// Professional error messages
const ERROR_MESSAGES: Record<string, string> = {
  'Invalid login credentials': 'Invalid email or password. Please try again.',
  'Email not confirmed': 'Please confirm your email address. Check your inbox for the confirmation link.',
  'Invalid API key': 'Authentication service unavailable. Please refresh the page.',
  'User already registered': 'This email is already registered. Please log in instead.',
  'Password should be at least 6 characters': 'Password must be at least 6 characters long.',
  'Signup requires a valid password': 'Please provide a valid password.',
  'validation_failed': 'Validation failed. Please check your input.',
  'Email link is invalid or has expired': 'This link has expired. Please request a new one.',
  'User not found': 'No account found with this email address.',
  'Invalid email': 'Please enter a valid email address.',
  'Auth session missing': 'You are not logged in. Please log in to continue.',
  'default': 'An error occurred. Please try again.'
};

// Helper function to translate errors to user-friendly messages
export const getUserFriendlyError = (errorMessage: string | undefined): string => {
  if (!errorMessage) return ERROR_MESSAGES.default;

  // Check for exact match
  if (ERROR_MESSAGES[errorMessage]) {
    return ERROR_MESSAGES[errorMessage];
  }

  // Check for partial matches
  if (errorMessage.toLowerCase().includes('password')) {
    return ERROR_MESSAGES['Password should be at least 6 characters'];
  }
  if (errorMessage.toLowerCase().includes('email')) {
    if (errorMessage.toLowerCase().includes('confirm')) {
      return ERROR_MESSAGES['Email not confirmed'];
    }
    return ERROR_MESSAGES['Invalid email'];
  }
  if (errorMessage.toLowerCase().includes('credential')) {
    return ERROR_MESSAGES['Invalid login credentials'];
  }
  if (errorMessage.toLowerCase().includes('already')) {
    return ERROR_MESSAGES['User already registered'];
  }

  return ERROR_MESSAGES.default;
};
