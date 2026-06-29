import React, { createContext, useContext, useEffect, useState, useMemo, ReactNode } from 'react';
import { User } from '../api/types';
import { tokenStorage } from '../api/tokens';

// Helper function to check if JWT token is expired
const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;
    return payload.exp < currentTime;
  } catch {
    return true; // If token is malformed, consider it expired
  }
};

interface AuthContextValue {
  user: User | null;
  setUser: (user: User | null) => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  clearAuth: () => void;
  login: (accessToken: string, refreshToken: string, user: User) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Track the access token in React state so `isAuthenticated` is reactive.
  // Reading `tokenStorage` directly during render would not re-render when a
  // silent refresh writes a new token, leaving consumers with stale auth state.
  const [accessToken, setAccessTokenState] = useState<string | null>(() =>
    tokenStorage.getAccessToken(),
  );

  // #559 — derive isAuthenticated once per token/user change, not on every render
  const isAuthenticated = useMemo(() => {
    const token = tokenStorage.getAccessToken();
    return !!user && !!token && !isTokenExpired(token);
  }, [user]);

  useEffect(() => {
    // Check token expiration on app load
    const checkTokenExpiration = () => {
      const currentToken = tokenStorage.getAccessToken();

      if (currentToken && isTokenExpired(currentToken)) {
        // Token is expired, clear auth state
      const accessToken = tokenStorage.getAccessToken();

      if (accessToken && isTokenExpired(accessToken)) {
        console.warn('Access token expired, clearing authentication state');
        tokenStorage.clearTokens();
        setUserState(null);
        setAccessTokenState(null);
        localStorage.removeItem('user');
      } else if (!currentToken) {
        // No token, clear user state
      } else if (!accessToken) {
        setUserState(null);
        setAccessTokenState(null);
        localStorage.removeItem('user');
      } else {
        // Valid token — keep reactive state in sync with storage.
        setAccessTokenState(currentToken);
      }

      setIsLoading(false);
    };

    checkTokenExpiration();

    // Keep AuthContext in sync when apiClient silently refreshes the access
    // token. Updating the reactive token (and user, when the refresh response
    // carries one) re-renders consumers so `isAuthenticated` reflects the new
    // valid token immediately, instead of waiting for the 5-minute check (#560).
    setTokenRefreshCallback((newAccessToken, refreshedUser) => {
      if (isTokenExpired(newAccessToken)) {
        return;
      }
      setAccessTokenState(newAccessToken);
      if (refreshedUser) {
        setUserState(refreshedUser);
      }
      setIsLoading(false);
    });

    // Set up periodic token expiration check (every 5 minutes)
    const interval = setInterval(checkTokenExpiration, 5 * 60 * 1000);

    return () => {
      clearInterval(interval);
      // Drop the callback so a torn-down provider can't update stale state.
      setTokenRefreshCallback(() => {});
    };
    const interval = setInterval(checkTokenExpiration, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user) {
      try {
        localStorage.setItem('user', JSON.stringify(user));
      } catch (e) {
        // #561 — warn on storage failure so auth loss is not silent
        console.warn(
          'Failed to persist user to localStorage (storage may be full or unavailable).',
          e
        );
      }
      return;
    }

    localStorage.removeItem('user');
    tokenStorage.clearTokens();
    setAccessTokenState(null);
  }, [user]);

  const setUser = (nextUser: User | null) => setUserState(nextUser);

  const clearAuth = () => {
    setUserState(null);
    tokenStorage.clearTokens();
    setAccessTokenState(null);
    localStorage.removeItem('user');
  };

  const login = (accessToken: string, refreshToken: string, nextUser: User) => {
    if (isTokenExpired(accessToken)) {
      console.error('Attempted to login with expired token');
      return;
    }

    tokenStorage.setAccessToken(accessToken);
    tokenStorage.setRefreshToken(refreshToken);
    setUserState(nextUser);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        isAuthenticated,
        isLoading,
        clearAuth,
        login,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
