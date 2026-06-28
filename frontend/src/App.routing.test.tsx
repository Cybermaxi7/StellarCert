import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';
import { useAuth } from './context/AuthContext';
import { User, UserRole } from './api/types';

// Keep providers/chrome and lazy pages light so we exercise only routing.
vi.mock('./context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: vi.fn(),
}));
vi.mock('./context/NotificationContext', () => ({
  NotificationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('./components/Header', () => ({ default: () => null }));
vi.mock('./components/Toast', () => ({ default: () => null }));
vi.mock('./pages/Login', () => ({ default: () => <div>Login Page</div> }));
vi.mock('./pages/IssuerProfile', () => ({ default: () => <div>Profile Page</div> }));
vi.mock('./pages/NotificationPreferences', () => ({
  default: () => <div>Preferences Page</div>,
}));

const authedUser: User = {
  id: '1',
  email: 'u@example.com',
  firstName: 'U',
  lastName: 'R',
  role: UserRole.USER,
};

const setUser = (user: User | null) =>
  vi.mocked(useAuth).mockReturnValue({
    user,
    setUser: vi.fn(),
    isAuthenticated: !!user,
    isLoading: false,
    clearAuth: vi.fn(),
    login: vi.fn(),
  });

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('App account-route protection (#566)', () => {
  it('redirects unauthenticated users away from /profile to login', async () => {
    setUser(null);
    renderAt('/profile');
    expect(await screen.findByText('Login Page')).toBeTruthy();
    expect(screen.queryByText('Profile Page')).toBeNull();
  });

  it('redirects unauthenticated users away from /preferences to login', async () => {
    setUser(null);
    renderAt('/preferences');
    expect(await screen.findByText('Login Page')).toBeTruthy();
    expect(screen.queryByText('Preferences Page')).toBeNull();
  });

  it('allows an authenticated user to view /profile', async () => {
    setUser(authedUser);
    renderAt('/profile');
    expect(await screen.findByText('Profile Page')).toBeTruthy();
  });

  it('allows an authenticated user to view /preferences', async () => {
    setUser(authedUser);
    renderAt('/preferences');
    expect(await screen.findByText('Preferences Page')).toBeTruthy();
  });
});
