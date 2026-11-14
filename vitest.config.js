import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Pin the timezone so date helpers behave the same locally and in CI.
// Test workers inherit this from the main process.
process.env.TZ = 'UTC';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/**/*.test.{js,jsx}', 'src/test/**'],
      // Global floor to stop overall coverage regressing badly. New/changed
      // lines are held to 80% separately by diff-cover in CI.
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 80,
        lines: 85,
      },
    },
  },
});
