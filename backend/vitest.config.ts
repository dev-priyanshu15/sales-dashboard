import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only source tests — never the compiled copies in dist/.
    include: ['src/**/*.test.ts'],
  },
});
