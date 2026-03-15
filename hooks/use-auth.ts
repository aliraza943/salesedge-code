import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { useCallback, useEffect, useMemo, useState } from "react";

type AuthState = {
  user: Auth.User | null;
  loading: boolean;
  error: Error | null;
};

let globalState: AuthState = {
  user: null,
  loading: true,
  error: null,
};

const listeners = new Set<(state: AuthState) => void>();
let hasFetchedUserOnce = false;

function notifyListeners() {
  for (const listener of listeners) {
    listener(globalState);
  }
}

function setGlobalState(partial: Partial<AuthState>) {
  globalState = { ...globalState, ...partial };
  notifyListeners();
}

async function fetchUserInternal(): Promise<Auth.User | null> {
  try {
    setGlobalState({ loading: true, error: null });
    const token = await Auth.getSessionToken();
    if (!token) {
      await Auth.clearUserInfo();
      setGlobalState({ user: null, loading: false });
      return null;
    }

    const apiUser = await Api.getMe();
    if (apiUser) {
      const userInfo: Auth.User = {
        id: apiUser.id,
        name: apiUser.name,
        username: apiUser.username,
        email: apiUser.email,
      };
      await Auth.setUserInfo(userInfo);
      setGlobalState({ user: userInfo, loading: false });
      return userInfo;
    }

    await Auth.clearUserInfo();
    await Auth.removeSessionToken();
    setGlobalState({ user: null, loading: false });
    return null;
  } catch (err) {
    const error = err instanceof Error ? err : new Error("Failed to fetch user");
    setGlobalState({ user: null, loading: false, error });
    return null;
  }
}

async function loginInternal(email: string, password: string): Promise<Auth.User> {
  const result = await Api.login({ email, password });
  await Auth.setSessionToken(result.token);
  await Auth.setUserInfo(result.user);
  setGlobalState({ user: result.user, loading: false, error: null });
  return result.user;
}

async function signUpInternal(data: {
  name: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  securityAnswer: string;
}): Promise<Auth.User> {
  const result = await Api.signUp(data);
  await Auth.setSessionToken(result.token);
  await Auth.setUserInfo(result.user);
  setGlobalState({ user: result.user, loading: false, error: null });
  return result.user;
}

async function logoutInternal(): Promise<void> {
  try {
    await Api.logout();
  } catch {
    // ignore
  } finally {
    await Auth.removeSessionToken();
    await Auth.clearUserInfo();
    setGlobalState({ user: null, loading: false, error: null });
  }
}

export function useAuth(options?: { autoFetch?: boolean }) {
  const { autoFetch = true } = options ?? {};
  const [state, setState] = useState<AuthState>(() => globalState);

  useEffect(() => {
    listeners.add(setState);
    // Immediately sync with current global state in case it changed before subscription
    setState(globalState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  useEffect(() => {
    if (autoFetch && !hasFetchedUserOnce) {
      hasFetchedUserOnce = true;
      void fetchUserInternal();
    } else if (!autoFetch && state.loading && !hasFetchedUserOnce) {
      // If a component opts out of autoFetch, don't leave it stuck in loading=true forever
      setGlobalState({ loading: false });
    }
  }, [autoFetch, state.loading]);

  const fetchUser = useCallback(async () => {
    return fetchUserInternal();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    return loginInternal(email, password);
  }, []);

  const signUp = useCallback(
    async (data: {
      name: string;
      username: string;
      email: string;
      password: string;
      confirmPassword: string;
      securityAnswer: string;
    }) => {
      return signUpInternal(data);
    },
    [],
  );

  const logout = useCallback(async () => {
    return logoutInternal();
  }, []);

  const isAuthenticated = useMemo(() => Boolean(state.user), [state.user]);

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    isAuthenticated,
    login,
    signUp,
    logout,
    refresh: fetchUser,
  };
}
