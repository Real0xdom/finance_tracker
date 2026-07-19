import { createClient } from '@store/supabase/supabase.sdk.ts';
import { debounce } from '@utils/debounce/debounce.ts';
import { createGlobalState, watchImmediate } from '@vueuse/core';
import { computed, nextTick, readonly, ref, shallowReactive, shallowRef, watch } from 'vue';
import type { StorageUser } from '@store/supabase/supabase.sdk.ts';
import type { MigratableState } from 'yuppee';

const { OCULAR_SUPABASE_URL, OCULAR_SUPABASE_ANON_KEY } = import.meta.env;

export type Storage = ReturnType<typeof useStorage>;

export type StorageAuthenticationState = 'idle' | 'authenticated' | 'syncing' | 'error' | 'retrying' | 'push-failed';

export type StorageSync<T extends MigratableState, P extends MigratableState = T> = {
  name: string;
  state(): T;
  clear(): void;
  push(data: P): void;
};

export const useStorage = createGlobalState(() => {
  const authenticatedUser = shallowRef<StorageUser | undefined>();
  const syncsFailed = shallowReactive<Set<() => Promise<void>>>(new Set());
  const pushFailed = ref(false);
  const syncsActive = ref(0);

  const logout = () => {
    authenticatedUser.value = undefined;
  };

  // the placeholder keeps the client constructible in offline mode, where all cloud features are disabled
  const store = createClient({
    url: OCULAR_SUPABASE_URL || 'https://offline.invalid',
    anonKey: OCULAR_SUPABASE_ANON_KEY || 'offline',
    onUnauthorized: logout
  });

  const login = async (user?: string, password?: string) =>
    store.login(user && password ? { user, password } : undefined).then((res) => {
      if (res.data) {
        authenticatedUser.value = res.data;
      }

      return res;
    });

  const sync = <T extends MigratableState, P extends MigratableState = T>(config: StorageSync<T, P>) => {
    const initializing = ref(true);
    const errored = ref(false);
    const syncing = ref(false);

    const push = async () => {
      syncing.value = true;

      await store
        .setDataByKey(config.name, config.state())
        .then(({ error }) => (errored.value = !!error))
        .finally(() => (syncing.value = false));
    };

    const change = debounce(push, 1000);

    // initial sync on log in
    watchImmediate([authenticatedUser, initializing], async ([user, init]) => {
      if (!user || !init) return;

      try {
        const { data, error } = await store.getDataByKey<P>(config.name);

        if (error) {
          logout();
        } else if (data) {
          config.push(data);
        }
      } catch {
        logout();
        pushFailed.value = true;
      } finally {
        await nextTick(() => (initializing.value = false));
      }
    });

    // push data
    watch(
      [authenticatedUser, config.state],
      ([user]) => {
        if (user && !initializing.value) {
          syncing.value = true;
          void change();
        }
      },
      { immediate: true, deep: true }
    );

    // clear on log out
    watch([authenticatedUser, syncing, initializing], ([user, syncing, init]) => {
      if (!user && !syncing && !init) {
        initializing.value = true;
        config.clear();
      }
    });

    // forward syncing status
    watch(syncing, (value) => (syncsActive.value += value ? 1 : -1));
    watch(errored, (value) => syncsFailed[value ? 'add' : 'delete'](push));
  };

  const retry = async () => {
    if (syncsFailed.size) {
      await Promise.allSettled([...syncsFailed].map((fn) => fn()));
    }
  };

  // clear on log out
  watch([authenticatedUser, syncsActive], ([user, syncsActive]) => {
    if (!user && !syncsActive) {
      void store.logout();
    }
  });

  const status = computed((): StorageAuthenticationState => {
    if (pushFailed.value) {
      return 'push-failed';
    } else if (syncsFailed.size) {
      return syncsActive.value ? 'retrying' : 'error';
    } else if (authenticatedUser.value) {
      return syncsActive.value ? 'syncing' : 'authenticated';
    } else {
      return 'idle';
    }
  });

  // Check if user is logged in
  if (OCULAR_SUPABASE_URL) {
    void login();
  }

  return {
    status,
    user: readonly(authenticatedUser),
    getAllUsers: store.getAllUsers,
    deleteUser: store.deleteUser,
    createUser: store.createUser,
    updateUser: store.updateUser,
    updatePassword: store.updatePassword,
    retry,
    login,
    logout,
    sync
  };
});
