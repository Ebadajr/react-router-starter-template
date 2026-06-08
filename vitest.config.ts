import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./app/test-setup.ts'],
    include: ['app/**/*.test.{ts,tsx}', 'workers/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['app/**/*.{ts,tsx}', 'workers/**/*.ts'],
      exclude: ['app/test-setup.ts', 'app/welcome/**'],
    },
  },
});
