import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');

    // ← SUPABASE: Load environment variables
    // Use environment variables from CI/CD or .env files
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
    const TRANSCRIPT_API_KEY = process.env.TRANSCRIPT_API_KEY || env.TRANSCRIPT_API_KEY;
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

    return {
      base: '/',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(GEMINI_API_KEY),
        'process.env.TRANSCRIPT_API_KEY': JSON.stringify(TRANSCRIPT_API_KEY),
        // ← SUPABASE: Expose Supabase credentials to client
        'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(SUPABASE_URL),
        'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(SUPABASE_ANON_KEY),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
