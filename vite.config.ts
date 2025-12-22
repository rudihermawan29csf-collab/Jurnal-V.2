import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all envs regardless of the `VITE_` prefix.
  // Fix: Cast process to any to resolve the TS error "Property 'cwd' does not exist on type 'Process'" when NodeJS types are not fully available.
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    base: './', 
    define: {
      // Expose variables to process.env for the client
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_API_KEY || ""),
      'process.env.VITE_SHEET_URL': JSON.stringify(env.VITE_SHEET_URL || env.SHEET_URL || "")
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    }
  };
});