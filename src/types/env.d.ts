/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Development
  readonly OCULAR_TEST_USERNAME?: string;
  readonly OCULAR_TEST_PASSWORD?: string;

  // Backend host, derived from OCULAR_SUPABASE_URL at build time — truthy when cloud sync is configured
  readonly OCULAR_GENESIS_HOST: string;
  readonly OCULAR_HYBRID_MODE?: string;

  // Supabase backend
  readonly OCULAR_SUPABASE_URL?: string;
  readonly OCULAR_SUPABASE_ANON_KEY?: string;

  // Build information
  readonly OCULAR_BUILD_TIMESTAMP: number;
  readonly OCULAR_BUILD_VERSION?: string;
  readonly OCULAR_BUILD_SHA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
