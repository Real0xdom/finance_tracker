import { minifyHtmlPlugin } from './plugins/vite-plugin-minify-html/minifyHtmlPlugin.ts';
import { minifyJsonPlugin } from './plugins/vite-plugin-minify-json/minifyJsonPlugin.ts';
import vue from '@vitejs/plugin-vue';
import { loadEnv } from 'vite';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import { VitePWA } from 'vite-plugin-pwa';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

const base = process.env.OCULAR_BASE_URL ?? '/';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'OCULAR'), ...process.env };

  return {
    base,
    envPrefix: ['OCULAR'],
    server: { port: 3000 },
    preview: { port: 3000 },
    define: {
      'import.meta.env.OCULAR_BUILD_TIMESTAMP': Date.now(),
      // a configured supabase project acts as the backend host, enabling all cloud/login features
      'import.meta.env.OCULAR_GENESIS_HOST': JSON.stringify(env.OCULAR_SUPABASE_URL ?? ''),
      'import.meta.env.OCULAR_SUPABASE_URL': JSON.stringify(env.OCULAR_SUPABASE_URL ?? ''),
      'import.meta.env.OCULAR_SUPABASE_ANON_KEY': JSON.stringify(env.OCULAR_SUPABASE_ANON_KEY ?? '')
    },
    resolve: {
      alias: {
        '@styles': '/src/styles'
      }
    },
    build: {
      target: 'ES2025'
    },
    plugins: [
      tsconfigPaths({ loose: true }),
      optimizeCssModules(),
      minifyJsonPlugin(),
      minifyHtmlPlugin(),
      vue(),
      VitePWA({
        manifest: {
          name: 'Ocular',
          short_name: 'Ocular',
          start_url: base,
          display: 'standalone',
          orientation: 'any',
          background_color: '#fff',
          theme_color: '#6bb1ff',
          description: 'Budgeting app',
          icons: [
            {
              src: `${base}images/icon-maskable-192x192.png`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: `${base}images/icon-maskable-256x256.png`,
              sizes: '256x256',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: `${base}images/icon-maskable-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: `${base}images/icon-maskable-1024x1024.png`,
              sizes: '1024x1024',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: `${base}images/icon-192x192.png`,
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: `${base}images/icon-512x512.png`,
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: `${base}images/icon-1024x1024.png`,
              sizes: '1024x1024',
              type: 'image/png'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,woff2,json}']
        }
      })
    ],
    test: {
      include: ['./src/**/*.spec.ts']
    }
  };
});
