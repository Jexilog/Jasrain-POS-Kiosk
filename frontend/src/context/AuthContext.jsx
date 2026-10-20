import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);

  const login = (username, password) => {
    if (username === 'admin' && password === 'admin123') {
      setAdmin({
        username: 'admin',
        role: 'Administrator',
      });

      return true;
    }

    return false;
  };

  const logout = () => {
    setAdmin(null);
  };

  return (
    <AuthContext.Provider
      value={{
        admin,
        login,
        logout,
        isAuthenticated: Boolean(admin),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}