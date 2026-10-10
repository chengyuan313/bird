import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tools/piachanLevel3Verification.test.ts'],
  },
});
