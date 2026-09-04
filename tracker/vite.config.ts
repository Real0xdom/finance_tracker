import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv } from 'vite';

// Env vars are exposed under the FT_ prefix so the supabase URL/key can be
// injected by CI without a .env file living in the repo.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'FT_');

  // Real environment variables win over the committed .env.production, so CI
  // secrets can still override; an empty variable is ignored rather than
  // clobbering the file value.
  const pick = (key: 'FT_SUPABASE_URL' | 'FT_SUPABASE_ANON_KEY') =>
    process.env[key]?.trim() || env[key]?.trim() || '';

  const url = pick('FT_SUPABASE_URL');
  const anonKey = pick('FT_SUPABASE_ANON_KEY');

  if (mode === 'production' && (!url || !anonKey || anonKey.startsWith('PASTE_'))) {
    throw new Error(
      'Supabase config missing. Set FT_SUPABASE_URL and FT_SUPABASE_ANON_KEY in tracker/.env.production (or as env vars).'
    );
  }

  return {
    plugins: [vue()],
    envPrefix: 'FT_',
    // relative base so the built assets resolve inside the capacitor webview
    base: './',
    define: {
      __FT_SUPABASE_URL__: JSON.stringify(url),
      __FT_SUPABASE_ANON_KEY__: JSON.stringify(anonKey)
    },
    build: { outDir: 'dist', emptyOutDir: true, target: 'es2020' }
  };
});
