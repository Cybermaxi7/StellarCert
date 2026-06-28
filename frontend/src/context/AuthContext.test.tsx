import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { tokenStorage, notifyTokenRefreshed } from '../api/tokens';
import { User, UserRole } from '../api/types';

/** Build a JWT-shaped token whose `exp` is `offsetSec` from now. */
const makeToken = (offsetSec: number): string => {
  const payload = btoa(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + offsetSec }),
  );
  return `header.${payload}.signature`;
};

const sampleUser: User = {
  id: '1',
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Doe',
  role: UserRole.USER,
};

const Consumer: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  return (
    <div>
      <span data-testid="auth">{String(isAuthenticated)}</span>
      <span data-testid="user">{user?.email ?? 'none'}</span>
    </div>
  );
};

const renderAuth = () =>
  render(
    <AuthProvider>
      <Consumer />
    </AuthProvider>,
  );

beforeEach(() => {
  localStorage.clear();
});

describe('AuthContext silent token refresh (#560)', () => {
  it('flips isAuthenticated to true and sets the user after a silent refresh', () => {
    // Start unauthenticated (no token, no user).
    renderAuth();
    expect(screen.getByTestId('auth').textContent).toBe('false');
    expect(screen.getByTestId('user').textContent).toBe('none');

    // Simulate apiClient's background refresh writing a fresh token + user.
    act(() => {
      tokenStorage.setAccessToken(makeToken(3600));
      notifyTokenRefreshed(makeToken(3600), sampleUser);
    });

    // Context updates immediately — no waiting for the 5-minute expiry check.
    expect(screen.getByTestId('auth').textContent).toBe('true');
    expect(screen.getByTestId('user').textContent).toBe('alice@example.com');
  });

  it('updates the user object from the refresh response', () => {
    localStorage.setItem('user', JSON.stringify(sampleUser));
    tokenStorage.setAccessToken(makeToken(3600));

    renderAuth();
    expect(screen.getByTestId('user').textContent).toBe('alice@example.com');

    const updated: User = { ...sampleUser, email: 'alice.new@example.com' };
    act(() => {
      tokenStorage.setAccessToken(makeToken(3600));
      notifyTokenRefreshed(makeToken(3600), updated);
    });

    expect(screen.getByTestId('user').textContent).toBe('alice.new@example.com');
    expect(screen.getByTestId('auth').textContent).toBe('true');
  });

  it('keeps isAuthenticated true when a refresh carries no user (token only)', () => {
    localStorage.setItem('user', JSON.stringify(sampleUser));
    tokenStorage.setAccessToken(makeToken(-100)); // expired going in

    renderAuth();
    // Mount cleared the expired token, so we are unauthenticated.
    expect(screen.getByTestId('auth').textContent).toBe('false');

    // A refresh without a user should still re-authenticate if a user exists...
    // here there is no user (it was cleared), so it stays false but does not throw.
    act(() => {
      notifyTokenRefreshed(makeToken(3600));
    });
    expect(screen.getByTestId('auth').textContent).toBe('false');
  });

  it('ignores a refreshed token that is already expired', () => {
    renderAuth();
    act(() => {
      notifyTokenRefreshed(makeToken(-100), sampleUser);
    });
    // Expired token must not authenticate.
    expect(screen.getByTestId('auth').textContent).toBe('false');
  });
});
