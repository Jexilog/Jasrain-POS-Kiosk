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
  const [user, setUser] = useState(loadUser);

  // the server said our login is no longer valid
  useEffect(() => {
    const onSignedOut = () => {
      sessionStorage.removeItem(USER_KEY);
      setUser(null);
    };
    window.addEventListener('jasrain-signed-out', onSignedOut);
    return () => window.removeEventListener('jasrain-signed-out', onSignedOut);
  }, []);

  // returns { ok } or { ok: false, error }
  const login = async (username, password) => {
    try {
      const { token, user: loggedInUser } = await api.post('/auth/login', { username, password });
      const person = { username: loggedInUser.username, role: loggedInUser.role };
      setToken(token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(person));
      setUser(person);
      return { ok: true, user: person };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  const logout = () => {
    setToken(null);
    sessionStorage.removeItem(USER_KEY);
    setUser(null);
  };

  const isAuthenticated = Boolean(user && getToken());

  const isAdmin = isAuthenticated && user.role === 'Administrator';
  const isStaff = isAuthenticated && user.role === 'Staff';

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated, isAdmin, isStaff}}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
