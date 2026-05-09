'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('ds_token');
    const cached = localStorage.getItem('ds_user');
    const isSubAgent = localStorage.getItem('ds_is_subagent') === 'true';

    if (token && cached) {
      try {
        setUser(JSON.parse(cached));
      } catch {}

      // Sub-agent tokens are scoped and cannot call /auth/me — that endpoint
      // would 403 and clear the session. Sub-agent pages validate the token
      // themselves via /subagent/* endpoints.
      if (isSubAgent) {
        setLoading(false);
        return;
      }

      // Verify main-portal token is still valid
      api.get('/auth/me').then(res => {
        const u = res.data.data.user;
        setUser(u);
        localStorage.setItem('ds_user', JSON.stringify(u));
      }).catch(() => {
        logout();
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('ds_token', token);
    localStorage.setItem('ds_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('ds_token');
    localStorage.removeItem('ds_user');
    localStorage.removeItem('ds_subagent');
    localStorage.removeItem('ds_is_subagent');
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      const u = res.data.data.user;
      setUser(u);
      localStorage.setItem('ds_user', JSON.stringify(u));
      return u;
    } catch {
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
