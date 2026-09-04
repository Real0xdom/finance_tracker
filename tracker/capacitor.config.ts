import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pranav.money',
  appName: 'Money',
  webDir: 'dist',
  android: { allowMixedContent: false },
  server: { androidScheme: 'https' }
};

export default config;
