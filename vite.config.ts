import { defineConfig } from 'vite';

export default defineConfig({
  base: '/bird/',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
