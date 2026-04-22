import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

const SESSION_KEY = 'attendance_app_auth';
const ADMIN_USERNAME = 'admin';
const LEGACY_ADMIN_PASSWORD = 'Plazer@123';
const ENHANCED_ADMIN_PASSWORD = 'Feelings';

export type AuthMode = 'legacy' | 'enhanced';

type AuthSession = {
  authenticated: boolean;
  mode: AuthMode;
};

interface AuthContextType {
  isAuthenticated: boolean;
  authMode: AuthMode | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readSession(): AuthSession | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  if (raw === '1') {
    return { authenticated: true, mode: 'legacy' };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (
      parsed.authenticated === true &&
      (parsed.mode === 'legacy' || parsed.mode === 'enhanced')
    ) {
      return { authenticated: true, mode: parsed.mode };
    }
  } catch {
    /* ignore bad session values */
  }
  return null;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(() => readSession());

  const login = useCallback((username: string, password: string) => {
    if (username === ADMIN_USERNAME) {
      let mode: AuthMode | null = null;
      if (password === LEGACY_ADMIN_PASSWORD) mode = 'legacy';
      if (password === ENHANCED_ADMIN_PASSWORD) mode = 'enhanced';
      if (mode) {
        const nextSession: AuthSession = { authenticated: true, mode };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
        setSession(nextSession);
        return true;
      }
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ isAuthenticated: session?.authenticated === true, authMode: session?.mode ?? null, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
