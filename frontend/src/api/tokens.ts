const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

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
  getRefreshToken: (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string): void => localStorage.setItem(REFRESH_TOKEN_KEY, token),
  clearTokens: (): void => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
  hasAccessToken: (): boolean => !!localStorage.getItem(ACCESS_TOKEN_KEY),
};
