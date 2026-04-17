'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SettingsContextValue {
  strictValidation: boolean;
  setStrictValidation: (value: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const STORAGE_KEY = 'deapi-strict-validation';

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return ctx;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [strictValidation, setStrictValidationState] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setStrictValidationState(stored === 'true');
    }
  }, []);

  const setStrictValidation = (value: boolean) => {
    setStrictValidationState(value);
    localStorage.setItem(STORAGE_KEY, String(value));
  };

  return (
    <SettingsContext.Provider value={{ strictValidation, setStrictValidation }}>
      {children}
    </SettingsContext.Provider>
  );
}
