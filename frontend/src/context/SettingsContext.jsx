import React, { createContext, useCallback, useContext, useState } from 'react';
import { toast } from 'react-toastify';
import { api } from '../api';
import { usePolling } from '../hooks/usePolling';

const SettingsContext = createContext();

export const DEFAULT_SETTINGS = {
  storeName: 'JASRAIN',
  printRates: { bw: 3, color: 10 }, // pesos per page
  defaultCritical: 5, // starting "low stock" level for new products
};

const num = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const load = useCallback(async () => {
    try {
      const saved = await api.get('/settings');
      setSettings({ ...DEFAULT_SETTINGS, ...saved, printRates: { ...DEFAULT_SETTINGS.printRates, ...saved.printRates } });
    } catch (e) {
      /* keep what we have */
    }
  }, []);

  usePolling(load, 30000);

  // shows the new value straight away, then saves it (admin only)
  const updateSettings = async (changes) => {
    const next = {
      ...settings,
      ...changes,
      printRates: {
        bw: num(changes.printRates?.bw, settings.printRates.bw),
        color: num(changes.printRates?.color, settings.printRates.color),
      },
      defaultCritical: num(changes.defaultCritical, settings.defaultCritical),
    };
    setSettings(next);
    try {
      await api.put('/settings', next);
    } catch (e) {
      toast.error(e.message);
      load();
    }
  };

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
