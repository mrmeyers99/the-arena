import { defineConfig } from 'vitest/config';

// Firestore security rules tests. Run with `npm run test:rules`, which starts
// the Firestore emulator and runs these tests against it. Kept separate from
// any unit-test Vitest config so the two suites don't interfere.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/firestore-rules/**/*.test.js'],
    // All tests share one emulator; run files serially so they don't clear
    // each other's data.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000
  }
});
