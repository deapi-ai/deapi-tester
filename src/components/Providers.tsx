'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from './ThemeContext';
import { ToastProvider } from './Toast';
import { BalanceProvider } from './BalanceContext';
import { ModelsProvider } from './ModelsContext';
import { SettingsProvider } from './SettingsContext';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <BalanceProvider>
          <ModelsProvider>
            <ToastProvider>{children}</ToastProvider>
          </ModelsProvider>
        </BalanceProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
