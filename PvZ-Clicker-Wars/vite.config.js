import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'copy-crystal',
      buildStart() {
        try {
          const src = path.resolve(__dirname, '../crystal.png');
          const dest = path.resolve(__dirname, 'public/crystal.png');
          if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
          }
        } catch (e) {
          console.error('Failed to copy crystal.png:', e);
        }
      }
    }
  ],
  server: {
    port: 3000,
    open: true,
  },
});
