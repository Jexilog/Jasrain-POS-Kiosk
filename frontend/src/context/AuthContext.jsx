import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../api';

const AuthContext = createContext();
const USER_KEY = 'jasrain_user';

// keeps you signed in after a refresh, until the tab is closed
function loadUser() {
  try {
    return getToken() ? JSON.parse(sessionStorage.getItem(USER_KEY)) : null;
  } catch (e) {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(loadUser);

  // the server said our login is no longer valid
  useEffect(() => {
    const onSignedOut = () => {
      sessionStorage.removeItem(USER_KEY);
      setAdmin(null);
    };
    window.addEventListener('jasrain-signed-out', onSignedOut);
    return () => window.removeEventListener('jasrain-signed-out', onSignedOut);
  }, []);

  // returns { ok } or { ok: false, error }
  const login = async (username, password) => {
    try {
      const { token, user } = await api.post('/auth/login', { username, password });
      const person = { username: user.username, role: user.role };
      setToken(token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(person));
      setAdmin(person);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  const logout = () => {
    setToken(null);
    sessionStorage.removeItem(USER_KEY);
    setAdmin(null);
  };

  return (
    <AuthContext.Provider value={{ admin, login, logout, isAuthenticated: Boolean(admin) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
