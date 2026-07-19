import { createClient as createSupabase } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';

export type StorageResponse<TData> =
  | {
      error: { message: string; status: number } & Record<string, unknown>;
      data?: undefined;
    }
  | { error?: undefined; data: TData };

export type StorageUser = {
  name: string;
  admin: boolean;
};

export type NewStorageUser = {
  name: string;
  password: string;
  admin: boolean;
};

export type LoginRequest = {
  user: string;
  password: string;
};

export type UpdatePasswordRequest = {
  newPassword: string;
  currentPassword: string;
};

export type SupabaseStoreOptions = {
  url: string;
  anonKey: string;
  onUnauthorized?: () => void;
};

const TABLE = 'user_data';

/**
 * Storage client backed by supabase.
 * Authentication uses supabase email/password auth (the "username" is the account email),
 * data is stored per key in a `user_data` table guarded by row level security.
 *
 * User management (admin) endpoints are not supported — users are managed
 * via the supabase dashboard instead.
 */
export const createClient = (opt: SupabaseStoreOptions) => {
  const supabase = createSupabase(opt.url, opt.anonKey);

  const toUser = (email: string | undefined): StorageUser => ({ name: email ?? 'user', admin: false });

  const getSession = async (): Promise<Session | null> => {
    const { data } = await supabase.auth.getSession();
    return data.session;
  };

  const login = async (body?: LoginRequest): Promise<StorageResponse<StorageUser>> => {
    if (!body) {
      // restore a previously persisted session
      const session = await getSession();
      return session
        ? { data: toUser(session.user.email) }
        : { error: { message: 'Not authenticated', status: 401 }, data: undefined };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: body.user,
      password: body.password
    });

    if (error) {
      const invalidCredentials = error.status === 400 || error.code === 'invalid_credentials';
      return {
        error: { message: error.message, status: invalidCredentials ? 401 : (error.status ?? -1) },
        data: undefined
      };
    }

    return { data: toUser(data.user.email) };
  };

  const signup = async (body: LoginRequest): Promise<StorageResponse<{ user: StorageUser; confirmed: boolean }>> => {
    const { data, error } = await supabase.auth.signUp({ email: body.user, password: body.password });

    if (error) {
      return { error: { message: error.message, status: error.status ?? -1 }, data: undefined };
    }

    // supabase returns no session if the account still needs to be confirmed via email
    return { data: { user: toUser(data.user?.email ?? body.user), confirmed: !!data.session } };
  };

  const logout = async (): Promise<StorageResponse<undefined>> => {
    await supabase.auth.signOut();
    return { data: undefined, error: undefined };
  };

  const updatePassword = async (body: UpdatePasswordRequest): Promise<StorageResponse<undefined>> => {
    const session = await getSession();

    if (!session?.user.email) {
      throw new Response(null, { status: 401 });
    }

    // verify the current password before changing it
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: body.currentPassword
    });

    if (verifyError) {
      throw new Response(null, { status: 401 });
    }

    const { error } = await supabase.auth.updateUser({ password: body.newPassword });

    if (error) {
      throw new Response(null, { status: error.status ?? 500 });
    }

    return { data: undefined, error: undefined };
  };

  const getData = async (): Promise<StorageResponse<Record<string, unknown>>> => {
    const { data, error } = await supabase.from(TABLE).select('key, data');

    if (error) {
      return { error: { message: error.message, status: -1 }, data: undefined };
    }

    return { data: Object.fromEntries(data.map((row) => [row.key, row.data])) };
  };

  const getDataByKey = async <P>(key: string): Promise<StorageResponse<P | undefined>> => {
    const session = await getSession();

    if (!session) {
      opt.onUnauthorized?.();
      return { error: { message: 'Not authenticated', status: 401 }, data: undefined };
    }

    const { data, error } = await supabase.from(TABLE).select('data').eq('key', key).maybeSingle();

    if (error) {
      return { error: { message: error.message, status: -1 }, data: undefined };
    }

    return { data: (data?.data ?? undefined) as P | undefined };
  };

  const setDataByKey = async (key: string, data: unknown): Promise<StorageResponse<undefined>> => {
    const session = await getSession();

    if (!session) {
      opt.onUnauthorized?.();
      return { error: { message: 'Not authenticated', status: 401 }, data: undefined };
    }

    const { error } = await supabase
      .from(TABLE)
      .upsert({ user_id: session.user.id, key, data }, { onConflict: 'user_id,key' });

    return error
      ? { error: { message: error.message, status: -1 }, data: undefined }
      : { data: undefined, error: undefined };
  };

  const deleteDataByKey = async (key: string): Promise<StorageResponse<undefined>> => {
    const { error } = await supabase.from(TABLE).delete().eq('key', key);

    return error
      ? { error: { message: error.message, status: -1 }, data: undefined }
      : { data: undefined, error: undefined };
  };

  const unsupported = { message: 'User management is handled via the supabase dashboard', status: 501 };

  const getAllUsers = async (): Promise<StorageResponse<StorageUser[]>> => ({ error: unsupported, data: undefined });

  const createUser = async (_body: NewStorageUser): Promise<StorageResponse<undefined>> => ({
    error: unsupported,
    data: undefined
  });

  const updateUser = async (_username: string, _user: StorageUser): Promise<StorageResponse<undefined>> => ({
    error: unsupported,
    data: undefined
  });

  const deleteUser = async (_username: string): Promise<StorageResponse<undefined>> => ({
    error: unsupported,
    data: undefined
  });

  return {
    login,
    signup,
    logout,
    updatePassword,
    getData,
    getDataByKey,
    setDataByKey,
    deleteDataByKey,
    getAllUsers,
    createUser,
    updateUser,
    deleteUser
  };
};
