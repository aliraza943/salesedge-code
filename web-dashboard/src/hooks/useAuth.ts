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
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setState({ user: data.user, isAuthenticated: true, loading: false });
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

  const login = useCallback(() => {
    // Build the OAuth login URL
    const appId = import.meta.env.VITE_APP_ID || '';
    const portalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL || 'https://manus.im';
    const redirectUri = `${window.location.origin}/api/oauth/callback`;
    const state = btoa(redirectUri);
    const url = `${portalUrl}/app-auth?appId=${appId}&redirectUri=${encodeURIComponent(redirectUri)}&state=${state}&type=signIn`;
    window.location.href = url;
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // ignore
    }
    setState({ user: null, isAuthenticated: false, loading: false });
  }, []);

  return { ...state, login, logout, refetch: checkAuth };
}
