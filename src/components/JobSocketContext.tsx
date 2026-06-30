'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';

// Realtime job-status event as delivered over the WebSocket
// (event "request.status.updated"). Payload is TOP-LEVEL (not wrapped in data).
export interface JobStatusEvent {
  request_id: string;
  status: string;                    // processing | in_progress | done  (error is webhook-only)
  preview?: string | null;           // base64 image (generation jobs only)
  result_url?: string | null;        // signed URL when complete
  progress?: string | number | null; // percentage, e.g. "45.50"
}

// Pusher connection lifecycle states, plus our own "disabled" when the active
// profile has no usable WebSocket configuration.
export type WsConnectionState =
  | 'disabled'
  | 'initialized'
  | 'connecting'
  | 'connected'
  | 'unavailable'
  | 'failed'
  | 'disconnected';

type JobStatusListener = (event: JobStatusEvent) => void;

interface JobSocketValue {
  connectionState: WsConnectionState;
  isConnected: boolean;
  isEnabled: boolean;          // active profile has WS configured & enabled
  addListener: (fn: JobStatusListener) => () => void;
  reconnect: () => void;       // rebuild the connection (e.g. after a profile switch)
}

const JobSocketContext = createContext<JobSocketValue | null>(null);

export function useJobSocket() {
  const ctx = useContext(JobSocketContext);
  if (!ctx) {
    throw new Error('useJobSocket must be used within JobSocketProvider');
  }
  return ctx;
}

interface ProfileWsConfig {
  wsEnabled?: boolean;
  wsKey?: string;
  wsHost?: string;
  wsPort?: number;
  wsForceTLS?: boolean;
  wsCluster?: string;
  wsClientId?: string;
}

export function JobSocketProvider({ children }: { children: ReactNode }) {
  const [connectionState, setConnectionState] = useState<WsConnectionState>('initialized');
  const [isEnabled, setIsEnabled] = useState(false);
  const [version, setVersion] = useState(0);
  const listenersRef = useRef<Set<JobStatusListener>>(new Set());

  const addListener = useCallback((fn: JobStatusListener) => {
    listenersRef.current.add(fn);
    return () => {
      listenersRef.current.delete(fn);
    };
  }, []);

  const reconnect = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // pusher-js type is loaded dynamically; keep a loose handle for cleanup.
    let pusher: { disconnect: () => void } | null = null;

    (async () => {
      let profile: ProfileWsConfig | undefined;
      try {
        const res = await fetch('/api/config');
        const data = await res.json();
        profile = (data.profiles || []).find(
          (p: { id: string }) => p.id === data.activeProfileId
        );
      } catch {
        if (!cancelled) setConnectionState('unavailable');
        return;
      }

      const usable =
        !!profile?.wsEnabled && !!profile?.wsKey && !!profile?.wsHost && !!profile?.wsClientId;

      if (!usable || cancelled) {
        setIsEnabled(false);
        setConnectionState('disabled');
        return;
      }
      setIsEnabled(true);
      setConnectionState('connecting');

      const { default: Pusher } = await import('pusher-js');
      if (cancelled) return;

      const client = new Pusher(profile!.wsKey!, {
        wsHost: profile!.wsHost,
        wsPort: profile!.wsPort || 443,
        wssPort: profile!.wsPort || 443,
        forceTLS: profile!.wsForceTLS ?? true,
        enabledTransports: ['ws', 'wss'],
        cluster: profile!.wsCluster || 'mt1',
        disableStats: true,
        channelAuthorization: { endpoint: '/api/ws-auth', transport: 'ajax' },
      });
      pusher = client;

      client.connection.bind('state_change', (states: { current: WsConnectionState }) => {
        if (!cancelled) setConnectionState(states.current);
      });

      const channel = client.subscribe(`private-client.${profile!.wsClientId}`);
      channel.bind('request.status.updated', (payload: JobStatusEvent) => {
        listenersRef.current.forEach((fn) => fn(payload));
      });
    })();

    return () => {
      cancelled = true;
      if (pusher) pusher.disconnect();
    };
  }, [version]);

  return (
    <JobSocketContext.Provider
      value={{
        connectionState,
        isConnected: connectionState === 'connected',
        isEnabled,
        addListener,
        reconnect,
      }}
    >
      {children}
    </JobSocketContext.Provider>
  );
}
