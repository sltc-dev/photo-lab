import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    clearMocks: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.spec.ts'],
    restoreMocks: true,
  },
});
