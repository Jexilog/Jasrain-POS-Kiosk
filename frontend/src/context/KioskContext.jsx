import React, { createContext, useContext, useState } from 'react';

const KioskContext = createContext();

// Kiosk-wide UI settings only. The cart lives in CartContext.
export function KioskProvider({ children }) {
  const [theme, setTheme] = useState('dark');
  const [language, setLanguage] = useState('English');

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  const toggleLanguage = () =>
    setLanguage((l) => (l === 'English' ? 'Tagalog' : 'English'));

  return (
    <KioskContext.Provider
      value={{ theme, setTheme, toggleTheme, language, setLanguage, toggleLanguage }}
    >
      {children}
    </KioskContext.Provider>
  );
}

export function useKiosk() {
  const context = useContext(KioskContext);
  if (!context) throw new Error('useKiosk must be used inside KioskProvider');
  return context;
}