import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const styles = {
  light: ImpactStyle.Light,
  medium: ImpactStyle.Medium,
  heavy: ImpactStyle.Heavy
} as const;

// no-op outside of the native android / ios apps
export const hapticFeedback = (style: keyof typeof styles = 'light'): void => {
  if (Capacitor.isNativePlatform()) {
    void Haptics.impact({ style: styles[style] }).catch(() => {});
  }
};
