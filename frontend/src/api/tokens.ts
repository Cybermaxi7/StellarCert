const ACCESS_TOKEN_KEY = 'accessToken';

// Called by apiClient after a silent token refresh so AuthContext can stay in sync.
let _onTokenRefreshed: ((accessToken: string) => void) | null = null;
export const setTokenRefreshCallback = (cb: (accessToken: string) => void) => {
  _onTokenRefreshed = cb;
};
export const notifyTokenRefreshed = (accessToken: string) => {
  _onTokenRefreshed?.(accessToken);
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
