'use client';

import { ReactNode } from 'react';
import { ToastProvider } from './Toast';
import { BalanceProvider } from './BalanceContext';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <BalanceProvider>
      <ToastProvider>{children}</ToastProvider>
    </BalanceProvider>
  );
}
