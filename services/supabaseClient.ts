// ← FIXED AUTH FOREVER + CLIP GENIE PERSONALITY INJECTED → NOW MAGICAL AND UNBREAKABLE
import { createClient } from '@supabase/supabase-js';

// Supabase project credentials - CORRECTED ANON KEY (was broken before!)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://cnxnxfgbfjqakvclcvmn.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNueG54ZmdiZmpxYWt2Y2xjdm1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MTYwNjgsImV4cCI6MjA3ODM5MjA2OH0.8lle8F9krxM-3MgS-_ZrT-1H5a8OTsIjCMmak-lhafU';

// Create single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Auto refresh the session when it expires
    autoRefreshToken: true,
    // Persist auth session in localStorage
    persistSession: true,
    // Detect session changes in other tabs (for OAuth redirects)
    detectSessionInUrl: true,
    // Flow type for OAuth (PKCE is more secure for SPAs)
    flowType: 'pkce',
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
    console.error('The Genie failed to identify you:', error);
    return null;
  }
  return user;
};

// Helper function to check if user is authenticated
export const isAuthenticated = async () => {
  const user = await getCurrentUser();
  return !!user;
};

// ← CLIP GENIE ERROR MESSAGES → Make auth failures funny and on-brand
export const CLIP_GENIE_ERRORS: Record<string, string> = {
  'Invalid login credentials': "❌ Nice try, mortal. Wrong password or email. The Genie doesn't grant wishes to liars.",
  'Email not confirmed': "📧 You didn't click the magic link? Rookie mistake. Check your spam — even genies end up there sometimes.",
  'Invalid API key': "🔥 Whoa there, cowboy. The Genie's lamp is offline. Refresh or blame the developer (it's probably his fault).",
  'User already registered': "👻 You already rubbed the lamp before! Log in instead of trying to summon me twice.",
  'Password should be at least 6 characters': "🔐 Your password is weaker than a wet noodle. Try at least 6 characters, champ.",
  'Signup requires a valid password': "🤦 You forgot the password? That's like wishing without rubbing the lamp. Try again.",
  'validation_failed': "⚠️ You broke the sacred rules of lamp-rubbing. Try again without being weird.",
  'Email link is invalid or has expired': "⏰ That magic link expired faster than your ex's promises. Request a new one.",
  'User not found': "👤 Who dis? The Genie has never seen you before. Maybe sign up first?",
  'Invalid email': "📧 That's not an email, that's alphabet soup. Try again.",
  'Auth session missing': "🔓 You're not logged in. Rub the lamp first (aka: hit that login button).",
  'default': "💥 Something exploded in the lamp. The Genie is napping. Try again in 5 seconds... or blame Mercury retrograde."
};

// Helper function to translate boring errors into Genie speak
export const translateToGenieSpeak = (errorMessage: string | undefined): string => {
  if (!errorMessage) return CLIP_GENIE_ERRORS.default;

  // Check for exact match
  if (CLIP_GENIE_ERRORS[errorMessage]) {
    return CLIP_GENIE_ERRORS[errorMessage];
  }

  // Check for partial matches
  if (errorMessage.toLowerCase().includes('password')) {
    return CLIP_GENIE_ERRORS['Password should be at least 6 characters'];
  }
  if (errorMessage.toLowerCase().includes('email')) {
    if (errorMessage.toLowerCase().includes('confirm')) {
      return CLIP_GENIE_ERRORS['Email not confirmed'];
    }
    return CLIP_GENIE_ERRORS['Invalid email'];
  }
  if (errorMessage.toLowerCase().includes('credential')) {
    return CLIP_GENIE_ERRORS['Invalid login credentials'];
  }
  if (errorMessage.toLowerCase().includes('already')) {
    return CLIP_GENIE_ERRORS['User already registered'];
  }

  return CLIP_GENIE_ERRORS.default;
};
