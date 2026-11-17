import React, { createContext, useCallback, useContext, useState } from 'react';
import TAGALOG from '../utils/tagalog';

const KioskContext = createContext();

// Kiosk-wide UI settings only. The cart lives in CartContext.
export function KioskProvider({ children }) {
  const [theme, setTheme] = useState('dark');
  const [language, setLanguage] = useState(() => {
    try { return localStorage.getItem('jasrain_language') === 'Tagalog' ? 'Tagalog' : 'English'; } catch (e) { return 'English'; }
  });

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  const toggleLanguage = () =>
    setLanguage((l) => {
      const next = l === 'English' ? 'Tagalog' : 'English';
      try { localStorage.setItem('jasrain_language', next); } catch (e) { /* storage blocked */ }
      return next;
    });

  // t('English text') gives the Tagalog text when Tagalog is on. Words with {name} get their value from vars:
  // t('Only {n} left', { n: 3 }). Anything without a translation stays in English.
  const t = useCallback((text, vars) => {
    let out = language === 'Tagalog' && TAGALOG[text] ? TAGALOG[text] : text;
    if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    return out;
  }, [language]);

  return (
    <KioskContext.Provider
      value={{ theme, setTheme, toggleTheme, language, setLanguage, toggleLanguage, t }}
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