import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');

    // Use environment variables from CI/CD or .env files
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
    const TRANSCRIPT_API_KEY = process.env.TRANSCRIPT_API_KEY || env.TRANSCRIPT_API_KEY;

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
        'process.env.TRANSCRIPT_API_KEY': JSON.stringify(TRANSCRIPT_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
