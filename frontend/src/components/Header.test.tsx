import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import Header from './Header';
import { useAuth } from '../context/AuthContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('./NotificationDropdown', () => ({
  default: () => <div>Notifications</div>,
}));

vi.mock('./ThemeToggle', () => ({
  default: () => <button type="button">Theme</button>,
}));

describe('Header mobile navigation', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      setUser: vi.fn(),
      isAuthenticated: false,
      isLoading: false,
      clearAuth: vi.fn(),
      login: vi.fn(),
    } as never);
  });

  it('opens and closes a slide-out mobile navigation drawer', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(menuButton);

    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Menu')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /close navigation menu/i }));

    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  });
});
