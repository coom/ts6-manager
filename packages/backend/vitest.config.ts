import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Runs before any test module is imported, so config.ts sees its required
    // secrets rather than aborting the runner.
    setupFiles: ['./src/test-setup.ts'],
  },
});
