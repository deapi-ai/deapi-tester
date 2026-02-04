'use client';

import { ReactNode } from 'react';
import { ToastProvider } from './Toast';
import { BalanceProvider } from './BalanceContext';
import { ModelsProvider } from './ModelsContext';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <BalanceProvider>
      <ModelsProvider>
        <ToastProvider>{children}</ToastProvider>
      </ModelsProvider>
    </BalanceProvider>
  );
}
