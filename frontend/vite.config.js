import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react({
      include: ['**/*.jsx', '**/*.js'],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:  ['react', 'react-dom', 'react-router-dom'],
          ui:      ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', 'lucide-react'],
          icons:   ['@phosphor-icons/react'],  // ~500KB — isolated for caching
          charts:  ['recharts'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['@sentry/react', '@sentry/browser'],
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
});