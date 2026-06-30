'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SettingsContextValue {
  strictValidation: boolean;
  setStrictValidation: (value: boolean) => void;
  showResponseHeaders: boolean;
  setShowResponseHeaders: (value: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const STRICT_VALIDATION_KEY = 'deapi-strict-validation';
const SHOW_RESPONSE_HEADERS_KEY = 'deapi-show-response-headers';

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return ctx;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [strictValidation, setStrictValidationState] = useState(false);
  const [showResponseHeaders, setShowResponseHeadersState] = useState(false);

  useEffect(() => {
    const strict = localStorage.getItem(STRICT_VALIDATION_KEY);
    if (strict !== null) {
      setStrictValidationState(strict === 'true');
    }
    const headers = localStorage.getItem(SHOW_RESPONSE_HEADERS_KEY);
    if (headers !== null) {
      setShowResponseHeadersState(headers === 'true');
    }
  }, []);

  const setStrictValidation = (value: boolean) => {
    setStrictValidationState(value);
    localStorage.setItem(STRICT_VALIDATION_KEY, String(value));
  };

  const setShowResponseHeaders = (value: boolean) => {
    setShowResponseHeadersState(value);
    localStorage.setItem(SHOW_RESPONSE_HEADERS_KEY, String(value));
  };

  return (
    <SettingsContext.Provider
      value={{ strictValidation, setStrictValidation, showResponseHeaders, setShowResponseHeaders }}
    >
      {children}
    </SettingsContext.Provider>
  );
}
