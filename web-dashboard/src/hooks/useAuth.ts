import { useState, useEffect, useCallback } from 'react';

interface User {
  id: number | null;
  openId: string | null;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  lastSignedIn: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    loading: true,
  });

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/trpc/auth.me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.result?.data) {
          setState({ user: data.result.data, isAuthenticated: true, loading: false });
          return;
        }
      }
      setState({ user: null, isAuthenticated: false, loading: false });
    } catch {
      setState({ user: null, isAuthenticated: false, loading: false });
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/trpc/auth.login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include'
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error?.message || 'Login failed');
    }
    
    const data = await res.json();
    if (data.result?.data?.success) {
      setState({ user: data.result.data.user, isAuthenticated: true, loading: false });
    }
    return data.result?.data;
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const res = await fetch('/api/trpc/auth.signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
      credentials: 'include'
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error?.message || 'Signup failed');
    }
    
    const data = await res.json();
    if (data.result?.data?.success) {
      setState({ user: data.result.data.user, isAuthenticated: true, loading: false });
    }
    return data.result?.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/trpc/auth.logout', { method: 'POST', credentials: 'include' });
    } catch {
      // ignore
    }
    setState({ user: null, isAuthenticated: false, loading: false });
  }, []);

  return { ...state, login, signup, logout, refetch: checkAuth };
}
