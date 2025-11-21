//  SUPABASE: Full auth + database + storage integration
import { createClient } from '@supabase/supabase-js';

// Supabase project credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://cnxnxfgbfjqakvclcvmn.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInRlZiI6ImNueG54ZmdiZmpxYWt2Y2xjdm1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MTYwNjgsImV4cCI6MjA3ODM5MjA2OH0.8lle8F9krxM-3MgS-_ZrT-1H5a8OTsIjCMmak-lhafU';

// Create single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Auto refresh the session when it expires
    autoRefreshToken: true,
    // Persist auth session in localStorage
    persistSession: true,
    // Detect session changes in other tabs
    detectSessionInUrl: true,
  },
});

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
