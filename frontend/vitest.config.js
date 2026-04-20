// vitest.config.js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/__tests__/setup.js'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// src/__tests__/setup.js
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  Toaster: () => null,
}));

// Mock react-router-dom navigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// Ajouts dans package.json scripts:
// "test":           "vitest run",
// "test:watch":     "vitest",
// "test:coverage":  "vitest run --coverage",
// "test:ui":        "vitest --ui",

// Dépendances dev à installer:
// npm install -D vitest @vitest/ui @vitejs/plugin-react
//             @testing-library/react @testing-library/user-event
//             @testing-library/jest-dom jsdom
//             @vitest/coverage-v8

// Pour pytest:
// pip install pytest pytest-asyncio httpx --break-system-packages
// Fichier pytest.ini :
// [pytest]
// asyncio_mode = auto
// testpaths = tests