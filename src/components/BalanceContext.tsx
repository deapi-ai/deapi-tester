'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

interface BalanceContextValue {
  balance: number | null;
  isLoading: boolean;
  refreshBalance: () => Promise<void>;
}

const BalanceContext = createContext<BalanceContextValue | null>(null);

export function useBalance() {
  const context = useContext(BalanceContext);
  if (!context) {
    throw new Error('useBalance must be used within BalanceProvider');
  }
  return context;
}

export function BalanceProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refreshBalance = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/balance');
      if (res.ok) {
        const data = await res.json();
        setBalance(data.data?.balance ?? null);
      }
    } catch (err) {
      console.error('[deapi-tester] Failed to fetch balance:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load balance on mount
  useEffect(() => {
    // Check if token exists first
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.hasToken) {
          refreshBalance();
        }
      })
      .catch(console.error);
  }, [refreshBalance]);

  return (
    <BalanceContext.Provider value={{ balance, isLoading, refreshBalance }}>
      {children}
    </BalanceContext.Provider>
  );
}
