'use client';

import { Wifi, WifiOff } from 'lucide-react';
import { useJobSocket } from './JobSocketContext';

// Realtime connection status, shown at the top of the page next to the balance.
// Green = WebSocket live (primary); yellow = connecting; red = configured but
// down (polling fallback active); muted = not configured for this profile.
export function WsIndicator() {
  const { isConnected, isEnabled, connectionState } = useJobSocket();

  const ind = (() => {
    if (!isEnabled) return { label: 'WS off', color: 'text-[var(--muted)]', live: false };
    if (isConnected) return { label: 'WS live', color: 'text-green-400', live: true };
    if (connectionState === 'connecting' || connectionState === 'initialized') {
      return { label: 'WS connecting', color: 'text-yellow-500', live: false };
    }
    return { label: 'WS down', color: 'text-red-400', live: false };
  })();

  return (
    <span
      className={`flex items-center gap-1 text-sm ${ind.color}`}
      title={
        isEnabled
          ? 'WebSocket is the primary status source; polling runs as a fallback.'
          : 'WebSocket not configured for this profile — using polling only. Add a Client ID in Settings to enable it.'
      }
    >
      {ind.live ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
      {ind.label}
    </span>
  );
}
