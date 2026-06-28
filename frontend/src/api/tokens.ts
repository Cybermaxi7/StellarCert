import type { User } from './types';

const ACCESS_TOKEN_KEY = 'accessToken';

/**
 * Callback invoked after `apiClient` silently refreshes the access token, so
 * AuthContext can keep its reactive `isAuthenticated` / `user` state in sync.
 * The fresh `user` from the refresh response is forwarded when available.
 */
type TokenRefreshCallback = (accessToken: string, user?: User | null) => void;

let _onTokenRefreshed: TokenRefreshCallback | null = null;
export const setTokenRefreshCallback = (cb: TokenRefreshCallback) => {
  _onTokenRefreshed = cb;
};
export const notifyTokenRefreshed = (accessToken: string, user?: User | null) => {
  _onTokenRefreshed?.(accessToken, user);
};

export const tokenStorage = {
  getAccessToken: (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY),
  setAccessToken: (token: string): void => localStorage.setItem(ACCESS_TOKEN_KEY, token),
  clearTokens: (): void => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    // The refresh token lives in an HttpOnly cookie managed by the server.
    // Clearing it requires a logout API call, not direct JS access.
  },
  hasAccessToken: (): boolean => !!localStorage.getItem(ACCESS_TOKEN_KEY),
};
