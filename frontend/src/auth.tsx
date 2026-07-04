import { createContext, useContext, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from './api/client';
import type { AuthUser } from './types';

interface AuthState {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const USER_KEY = 'sales_user';

function storedUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw && getToken() ? (JSON.parse(raw) as AuthUser) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(storedUser);

  async function handleAuth(path: string, email: string, password: string) {
    const res = await api.post<{ token: string; user: AuthUser }>(path, { email, password });
    setToken(res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    setUser(res.user);
  }

  const value: AuthState = {
    user,
    login: (email, password) => handleAuth('/api/auth/login', email, password),
    signup: (email, password) => handleAuth('/api/auth/signup', email, password),
    logout: () => {
      setToken(null);
      localStorage.removeItem(USER_KEY);
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
