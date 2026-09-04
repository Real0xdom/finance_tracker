import { computed, ref, watchEffect } from 'vue';

export type ThemePref = 'system' | 'light' | 'dark';

const KEY = 'ft-theme';

const read = (): ThemePref => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  } catch {
    return 'system';
  }
};

/** User's stored preference: system, light, or dark. */
export const themePref = ref<ThemePref>(read());

const systemPrefersDark = ref(
  typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)').matches : true
);

if (typeof matchMedia !== 'undefined') {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    systemPrefersDark.value = e.matches;
  });
}

/** What actually renders, after resolving "system" against the OS setting. */
export const effectiveTheme = computed<'light' | 'dark'>(() =>
  themePref.value === 'system' ? (systemPrefersDark.value ? 'dark' : 'light') : themePref.value
);

export const setThemePref = (pref: ThemePref) => {
  themePref.value = pref;
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* private browsing or storage disabled -- preference just won't survive a restart */
  }
};

// Stamp the resolved theme on <html> so CSS custom properties swap everywhere,
// including the login screen before any Supabase call has happened.
watchEffect(() => {
  document.documentElement.dataset.theme = effectiveTheme.value;
});
