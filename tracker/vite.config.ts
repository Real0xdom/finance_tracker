import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv } from 'vite';

// Env vars are exposed under the FT_ prefix so the supabase URL/key can be
// injected by CI without a .env file living in the repo.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'FT_');

  return {
    plugins: [vue()],
    envPrefix: 'FT_',
    // relative base so the built assets resolve inside the capacitor webview
    base: './',
    define: {
      __FT_SUPABASE_URL__: JSON.stringify(env.FT_SUPABASE_URL ?? ''),
      __FT_SUPABASE_ANON_KEY__: JSON.stringify(env.FT_SUPABASE_ANON_KEY ?? '')
    },
    build: { outDir: 'dist', emptyOutDir: true, target: 'es2020' }
  };
});
