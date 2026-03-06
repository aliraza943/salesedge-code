import * as Auth from "@/lib/_core/auth";
import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

type UseAuthOptions = {
  autoFetch?: boolean;
};

export function useAuth(options?: UseAuthOptions) {
  const { autoFetch = true } = options ?? {};
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const utils = trpc.useUtils();
  const loginMutation = trpc.auth.login.useMutation();
  const signupMutation = trpc.auth.signup.useMutation();
  const logoutMutation = trpc.auth.logout.useMutation();

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const apiUser = await utils.auth.me.fetch();

      if (apiUser) {
        const userInfo: Auth.User = {
          id: apiUser.id,
          openId: apiUser.openId || "",
          name: apiUser.name,
          email: apiUser.email,
          loginMethod: apiUser.loginMethod,
          lastSignedIn: new Date(apiUser.lastSignedIn),
        };
        setUser(userInfo);
        await Auth.setUserInfo(userInfo);
      } else {
        setUser(null);
        await Auth.clearUserInfo();
      }
    } catch (err) {
      console.error("[useAuth] fetchUser error:", err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [utils]);

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      const result = await loginMutation.mutateAsync({ email, password });
      if (result.sessionToken) {
        await Auth.setSessionToken(result.sessionToken);
        const userInfo: Auth.User = {
          id: result.user.id,
          openId: result.user.openId || "",
          name: result.user.name,
          email: result.user.email,
          loginMethod: result.user.loginMethod,
          lastSignedIn: new Date(result.user.lastSignedIn),
        };
        setUser(userInfo);
        await Auth.setUserInfo(userInfo);
      }
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Login failed"));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    try {
      setLoading(true);
      const result = await signupMutation.mutateAsync({ name, email, password });
      if (result.sessionToken) {
        await Auth.setSessionToken(result.sessionToken);
        const userInfo: Auth.User = {
          id: result.user.id,
          openId: result.user.openId || "",
          name: result.user.name,
          email: result.user.email,
          loginMethod: result.user.loginMethod,
          lastSignedIn: new Date(result.user.lastSignedIn),
        };
        setUser(userInfo);
        await Auth.setUserInfo(userInfo);
      }
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Signup failed"));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (err) {
      console.error("[Auth] Logout API call failed:", err);
    } finally {
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      setUser(null);
      setError(null);
    }
  }, [logoutMutation]);

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
    refresh: fetchUser,
    login,
    signup,
    logout,
  };
}
