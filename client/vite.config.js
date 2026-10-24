import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * The `shared/` folder holds the rule engine and the SMS parser. They are
 * imported by the client so the Safety Checker and Explainer keep working
 * OFFLINE, using exactly the same code the server runs.
 */
const sharedPath = path.resolve(__dirname, '../shared');

export default defineConfig({
  // The repo root is the cwd now that there is a single package.json, but the
  // app still lives in `client/`. Without this, vite looks for `index.html` at
  // the repo root (not found) and writes the build to `<repo>/dist`. Pinning
  // root here keeps `dist/`, `public/`, `index.html` and the postcss/tailwind
  // config discovery exactly where they were under the old workspaces layout.
  root: __dirname,
  // A single root `.env` serves both the client and the server, so Vite has to
  // look one level up instead of at `client/`. Only VITE_-prefixed vars are
  // exposed to the app; the rest (PORT, CLIENT_ORIGIN) stay server-side.
  envDir: path.resolve(__dirname, '..'),
  plugins: [
    react(),
    // PWA: pre-caches the app shell so the core guide flows open without a
    // network. Runtime caching is left off for /api (POST requests cannot be
    // cached usefully) - the client falls back to the shared modules + local
    // storage instead.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icons/*.png'],
      manifest: {
        name: 'VoicePay - Easy UPI for Everyone',
        short_name: 'VoicePay',
        description:
          'A voice-guided helper that explains UPI messages and warns about fraud. Never moves money.',
        theme_color: '#0b5cab',
        background_color: '#f4f8fd',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'en-IN',
        categories: ['finance', 'education', 'accessibility'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // API responses and Tesseract workers must never be served from cache.
        navigateFallbackDenylist: [/^\/api/],
      },
      devOptions: {
        enabled: false, // keep `npm run dev` fast; test the SW on `npm run preview`
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': sharedPath,
    },
  },
  server: {
    port: 5173,
    // Vite by default refuses to serve files outside the project root; the
    // shared/ folder is a sibling, so allow it explicitly.
    fs: { allow: [path.resolve(__dirname), sharedPath] },
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Explicit: with `root` above, a bare 'dist' would resolve against the repo
    // root anyway, and a future cwd change would silently move the output.
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        // Tesseract.js is ~1MB and only needed on the Safety Checker screen.
        // Split it so the app shell stays light on a slow phone connection.
        manualChunks: {
          motion: ['framer-motion'],
          ocr: ['tesseract.js'],
        },
      },
    },
  },
});
