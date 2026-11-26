import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: true },
  build: {
    // three.js alone is ~600 kB minified; one chunk is fine for a single-page site.
    chunkSizeWarningLimit: 900,
  },
});
