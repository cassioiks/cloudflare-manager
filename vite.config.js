import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const fromRoot = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: fromRoot('./frontend'),
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss(fromRoot('./tailwind.config.js')), autoprefixer()],
    },
  },
  server: {
    // `npm run dev` serves the UI with hot reload and forwards API calls
    // to the Node server started with `npm run dev:server`.
    proxy: {
      '/api': `http://localhost:${process.env.PORT || 5480}`,
    },
  },
  build: {
    outDir: fromRoot('./dist'),
    emptyOutDir: true,
  },
});
