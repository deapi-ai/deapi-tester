'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from './ThemeContext';
import { ToastProvider } from './Toast';
import { BalanceProvider } from './BalanceContext';
import { ModelsProvider } from './ModelsContext';
import { SettingsProvider } from './SettingsContext';
import { JobSocketProvider } from './JobSocketContext';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <BalanceProvider>
          <ModelsProvider>
            <JobSocketProvider>
              <ToastProvider>{children}</ToastProvider>
            </JobSocketProvider>
          </ModelsProvider>
        </BalanceProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
