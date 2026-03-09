import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function useAuth(options?: { autoFetch?: boolean }) {
  const { autoFetch = true } = options ?? {};
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const userRef = useRef<Auth.User | null>(null);

  const setUserIfDifferent = useCallback((newUser: Auth.User | null) => {
    if (JSON.stringify(newUser) !== JSON.stringify(userRef.current)) {
      userRef.current = newUser;
      setUser(newUser);
    }
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await Auth.getSessionToken();
      if (!token) {
        setUserIfDifferent(null);
        return;
      }
      const apiUser = await Api.getMe();
      if (apiUser) {
        const userInfo: Auth.User = {
          id: apiUser.id,
          name: apiUser.name,
          username: apiUser.username,
          email: apiUser.email,
        };
        setUserIfDifferent(userInfo);
        await Auth.setUserInfo(userInfo);
      } else {
        setUserIfDifferent(null);
        await Auth.clearUserInfo();
        await Auth.removeSessionToken();
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch user"));
      setUserIfDifferent(null);
    } finally {
      setLoading(false);
    }
  }, [setUserIfDifferent]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await Api.login({ email, password });
      await Auth.setSessionToken(result.token);
      await Auth.setUserInfo(result.user);
      setUserIfDifferent(result.user);
      return result.user;
    },
    [setUserIfDifferent]
  );

  const signUp = useCallback(
    async (data: { name: string; username: string; email: string; password: string; confirmPassword: string }) => {
      const result = await Api.signUp(data);
      await Auth.setSessionToken(result.token);
      await Auth.setUserInfo(result.user);
      setUserIfDifferent(result.user);
      return result.user;
    },
    [setUserIfDifferent]
  );

  const logout = useCallback(async () => {
    try {
      await Api.logout();
    } catch {
      // ignore
    } finally {
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      setUserIfDifferent(null);
      setError(null);
    }
  }, [setUserIfDifferent]);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  useEffect(() => {
    if (autoFetch) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [autoFetch, fetchUser]);

  return {
    user,
    loading,
    error,
    isAuthenticated,
    login,
    signUp,
    logout,
    refresh: fetchUser,
  };
}
