import * as fs from 'fs';
import * as path from 'path';
import { AppConfig, AppConfigFull, ConfigProfile } from './types';

const CONFIG_PATH = path.join(process.cwd(), 'data', 'config.json');

// Generate unique ID for profiles
function generateProfileId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Known WebSocket (Pusher/soketi) presets per environment, matched against the
// profile's apiUrl host. Lets a profile auto-fill its WS connection so the user
// only needs to add the dashboard clientId. Order matters (most specific first).
interface WsPreset {
  match: (host: string) => boolean;
  ws: Pick<ConfigProfile, 'wsKey' | 'wsHost' | 'wsPort' | 'wsForceTLS' | 'wsCluster'>;
}

const WS_PRESETS: WsPreset[] = [
  {
    // Sandbox (…sandbox.deapi.dev)
    match: (host) => host.includes('sandbox'),
    ws: { wsKey: 'depin-api-dev-key', wsHost: 'soketi-depin-api.sandbox.deapi.dev', wsPort: 443, wsForceTLS: true, wsCluster: 'mt1' },
  },
  {
    // Dev (…ghash.dev)
    match: (host) => host.includes('ghash.dev'),
    ws: { wsKey: 'depin-api-dev-key', wsHost: 'depin-soketi-dev.ghash.dev', wsPort: 443, wsForceTLS: true, wsCluster: 'mt1' },
  },
  {
    // Production (api.deapi.ai)
    match: (host) => host.includes('deapi.ai'),
    ws: { wsKey: 'depin-api-prod-key', wsHost: 'soketi.deapi.ai', wsPort: 443, wsForceTLS: true, wsCluster: 'mt1' },
  },
];

// Resolve the broadcasting/auth URL for a profile. Explicit wsAuthUrl wins;
// otherwise derive from the apiUrl origin (auth lives at the ROOT, not /api/v2).
export function resolveWsAuthUrl(profile: ConfigProfile): string {
  if (profile.wsAuthUrl && profile.wsAuthUrl.trim()) return profile.wsAuthUrl.trim();
  try {
    return `${new URL(profile.apiUrl).origin}/broadcasting/auth`;
  } catch {
    return '';
  }
}

// Fill in missing WebSocket fields from the matching environment preset so a
// profile works out of the box. Never overwrites values the user has set.
function normalizeProfile(profile: ConfigProfile): ConfigProfile {
  let host = '';
  try {
    host = new URL(profile.apiUrl).host;
  } catch {
    host = '';
  }
  const preset = host ? WS_PRESETS.find((p) => p.match(host))?.ws : undefined;

  return {
    ...profile,
    wsEnabled: profile.wsEnabled ?? true,
    wsKey: profile.wsKey ?? preset?.wsKey ?? '',
    wsHost: profile.wsHost ?? preset?.wsHost ?? '',
    wsPort: profile.wsPort ?? preset?.wsPort ?? 443,
    wsForceTLS: profile.wsForceTLS ?? preset?.wsForceTLS ?? true,
    wsCluster: profile.wsCluster ?? preset?.wsCluster ?? 'mt1',
    wsClientId: profile.wsClientId ?? '',
    wsAuthUrl: profile.wsAuthUrl ?? '',
  };
}

// Default profile
const DEFAULT_PROFILE: ConfigProfile = {
  id: 'default',
  name: 'Default',
  apiUrl: 'https://api.deapi.ai/api/v2',
  apiToken: '',
};

// Default full configuration
const DEFAULT_CONFIG_FULL: AppConfigFull = {
  activeProfileId: 'default',
  profiles: [DEFAULT_PROFILE],
  outputDir: './output',
  pollingIntervalMs: 2000,
  maxPollingAttempts: 120,
  fallbackPollIntervalMs: 10000,
};

// Check if config is old format (flat) or new format (with profiles)
interface OldConfig {
  apiUrl?: string;
  apiToken?: string;
  outputDir?: string;
  pollingIntervalMs?: number;
  maxPollingAttempts?: number;
}

function isOldFormat(config: unknown): config is OldConfig {
  return typeof config === 'object' && config !== null && !('profiles' in config);
}

// Migrate old config to new format
function migrateOldConfig(oldConfig: OldConfig): AppConfigFull {
  const profile: ConfigProfile = {
    id: 'default',
    name: 'Default',
    apiUrl: oldConfig.apiUrl || DEFAULT_PROFILE.apiUrl,
    apiToken: oldConfig.apiToken || '',
  };

  return {
    activeProfileId: 'default',
    profiles: [profile],
    outputDir: oldConfig.outputDir || DEFAULT_CONFIG_FULL.outputDir,
    pollingIntervalMs: oldConfig.pollingIntervalMs || DEFAULT_CONFIG_FULL.pollingIntervalMs,
    maxPollingAttempts: oldConfig.maxPollingAttempts || DEFAULT_CONFIG_FULL.maxPollingAttempts,
    fallbackPollIntervalMs: DEFAULT_CONFIG_FULL.fallbackPollIntervalMs,
  };
}

// Load full configuration with all profiles
export function loadFullConfig(): AppConfigFull {
  try {
    let config: AppConfigFull = { ...DEFAULT_CONFIG_FULL, profiles: [...DEFAULT_CONFIG_FULL.profiles] };

    if (fs.existsSync(CONFIG_PATH)) {
      const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const fileConfig = JSON.parse(content);

      // Migrate old format if needed
      if (isOldFormat(fileConfig)) {
        config = migrateOldConfig(fileConfig);
        // Save migrated config
        saveFullConfig(config);
      } else {
        config = { ...DEFAULT_CONFIG_FULL, ...fileConfig };
      }
    }

    // Backfill WebSocket defaults (presets) for every profile.
    config.profiles = config.profiles.map(normalizeProfile);

    // Environment variables override active profile settings
    if (config.profiles.length > 0) {
      const activeProfile = config.profiles.find(p => p.id === config.activeProfileId);
      if (activeProfile) {
        if (process.env.DEAPI_API_TOKEN && process.env.DEAPI_API_TOKEN !== 'your_token_here') {
          activeProfile.apiToken = process.env.DEAPI_API_TOKEN;
        }
        if (process.env.DEAPI_API_URL) {
          activeProfile.apiUrl = process.env.DEAPI_API_URL;
        }
      }
    }

    if (process.env.DEAPI_OUTPUT_DIR) {
      config.outputDir = process.env.DEAPI_OUTPUT_DIR;
    }
    if (process.env.DEAPI_POLLING_INTERVAL_MS) {
      config.pollingIntervalMs = parseInt(process.env.DEAPI_POLLING_INTERVAL_MS, 10);
    }
    if (process.env.DEAPI_MAX_POLLING_ATTEMPTS) {
      config.maxPollingAttempts = parseInt(process.env.DEAPI_MAX_POLLING_ATTEMPTS, 10);
    }
    if (process.env.DEAPI_FALLBACK_POLLING_INTERVAL_MS) {
      config.fallbackPollIntervalMs = parseInt(process.env.DEAPI_FALLBACK_POLLING_INTERVAL_MS, 10);
    }

    return config;
  } catch (error) {
    console.error('[deapi-tester] Error loading config:', error);
    return { ...DEFAULT_CONFIG_FULL, profiles: [...DEFAULT_CONFIG_FULL.profiles] };
  }
}

// Load flat config (for backward compatibility)
// Returns active profile merged with global settings
export function loadConfig(): AppConfig {
  const fullConfig = loadFullConfig();
  const activeProfile = fullConfig.profiles.find(p => p.id === fullConfig.activeProfileId)
    || fullConfig.profiles[0]
    || DEFAULT_PROFILE;

  return {
    apiUrl: activeProfile.apiUrl,
    apiToken: activeProfile.apiToken,
    outputDir: fullConfig.outputDir,
    pollingIntervalMs: fullConfig.pollingIntervalMs,
    maxPollingAttempts: fullConfig.maxPollingAttempts,
  };
}

// Save full configuration
export function saveFullConfig(config: AppConfigFull): AppConfigFull {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Write atomically
    const tempPath = CONFIG_PATH + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(config, null, 2), 'utf-8');
    fs.renameSync(tempPath, CONFIG_PATH);

    return config;
  } catch (error) {
    console.error('[deapi-tester] Error saving config:', error);
    throw error;
  }
}

// Save partial config (backward compatibility - updates active profile)
export function saveConfig(updates: Partial<AppConfig>): AppConfig {
  const fullConfig = loadFullConfig();
  const activeProfile = fullConfig.profiles.find(p => p.id === fullConfig.activeProfileId);

  if (activeProfile) {
    if (updates.apiUrl !== undefined) activeProfile.apiUrl = updates.apiUrl;
    if (updates.apiToken !== undefined) activeProfile.apiToken = updates.apiToken;
  }

  if (updates.outputDir !== undefined) fullConfig.outputDir = updates.outputDir;
  if (updates.pollingIntervalMs !== undefined) fullConfig.pollingIntervalMs = updates.pollingIntervalMs;
  if (updates.maxPollingAttempts !== undefined) fullConfig.maxPollingAttempts = updates.maxPollingAttempts;

  saveFullConfig(fullConfig);
  return loadConfig();
}

// Get active profile
export function getActiveProfile(): ConfigProfile | undefined {
  const fullConfig = loadFullConfig();
  return fullConfig.profiles.find(p => p.id === fullConfig.activeProfileId);
}

// Set active profile
export function setActiveProfile(profileId: string): AppConfigFull {
  const fullConfig = loadFullConfig();
  const profile = fullConfig.profiles.find(p => p.id === profileId);

  if (!profile) {
    throw new Error(`Profile not found: ${profileId}`);
  }

  fullConfig.activeProfileId = profileId;
  return saveFullConfig(fullConfig);
}

// Add new profile
export function addProfile(profile: Omit<ConfigProfile, 'id'>): ConfigProfile {
  const fullConfig = loadFullConfig();
  const newProfile: ConfigProfile = {
    ...profile,
    id: generateProfileId(),
  };

  fullConfig.profiles.push(newProfile);
  saveFullConfig(fullConfig);

  return newProfile;
}

// Update profile
export function updateProfile(profileId: string, updates: Partial<Omit<ConfigProfile, 'id'>>): ConfigProfile {
  const fullConfig = loadFullConfig();
  const profile = fullConfig.profiles.find(p => p.id === profileId);

  if (!profile) {
    throw new Error(`Profile not found: ${profileId}`);
  }

  if (updates.name !== undefined) profile.name = updates.name;
  if (updates.apiUrl !== undefined) profile.apiUrl = updates.apiUrl;
  if (updates.apiToken !== undefined) profile.apiToken = updates.apiToken;
  // WebSocket fields
  if (updates.wsEnabled !== undefined) profile.wsEnabled = updates.wsEnabled;
  if (updates.wsKey !== undefined) profile.wsKey = updates.wsKey;
  if (updates.wsHost !== undefined) profile.wsHost = updates.wsHost;
  if (updates.wsPort !== undefined) profile.wsPort = updates.wsPort;
  if (updates.wsForceTLS !== undefined) profile.wsForceTLS = updates.wsForceTLS;
  if (updates.wsCluster !== undefined) profile.wsCluster = updates.wsCluster;
  if (updates.wsClientId !== undefined) profile.wsClientId = updates.wsClientId;
  if (updates.wsAuthUrl !== undefined) profile.wsAuthUrl = updates.wsAuthUrl;

  saveFullConfig(fullConfig);
  return profile;
}

// Delete profile
export function deleteProfile(profileId: string): AppConfigFull {
  const fullConfig = loadFullConfig();

  if (fullConfig.profiles.length <= 1) {
    throw new Error('Cannot delete the last profile');
  }

  const index = fullConfig.profiles.findIndex(p => p.id === profileId);
  if (index === -1) {
    throw new Error(`Profile not found: ${profileId}`);
  }

  fullConfig.profiles.splice(index, 1);

  // If deleted profile was active, switch to first available
  if (fullConfig.activeProfileId === profileId) {
    fullConfig.activeProfileId = fullConfig.profiles[0].id;
  }

  return saveFullConfig(fullConfig);
}

// Get config value (backward compatibility)
export function getConfigValue<K extends keyof AppConfig>(key: K): AppConfig[K] {
  const config = loadConfig();
  return config[key];
}
