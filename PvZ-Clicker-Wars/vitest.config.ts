import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [
    vue({
      template: {
        transformAssetUrls: false,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['resources/js/**/*.test.ts'],
    setupFiles: ['./resources/js/testSetup.ts'],
    globals: false,
  },
});
