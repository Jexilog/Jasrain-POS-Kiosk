import React, { createContext, useContext, useEffect, useState } from 'react';

const SettingsContext = createContext();
const KEY = 'jasrain_settings';

export const DEFAULT_SETTINGS = {
  storeName: 'JASRAIN',
  printRates: { bw: 3, color: 10 }, // pesos per page
  defaultCritical: 5, // starting "low stock" level for new products
};

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && typeof saved === 'object') {
      return {
        ...DEFAULT_SETTINGS,
        ...saved,
        printRates: { ...DEFAULT_SETTINGS.printRates, ...(saved.printRates || {}) },
      };
    }
  } catch (e) {
    /* use defaults */
  }
  return DEFAULT_SETTINGS;
}

const num = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch (e) {
      /* storage blocked */
    }
  }, [settings]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === KEY) setSettings(load());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const updateSettings = (changes) =>
    setSettings((cur) => ({
      ...cur,
      ...changes,
      printRates: {
        bw: num(changes.printRates?.bw, cur.printRates.bw),
        color: num(changes.printRates?.color, cur.printRates.color),
      },
      defaultCritical: num(changes.defaultCritical, cur.defaultCritical),
    }));

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside SettingsProvider');
  return context;
}
