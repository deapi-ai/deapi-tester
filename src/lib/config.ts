import * as fs from 'fs';
import * as path from 'path';
import { AppConfig } from './types';

const CONFIG_PATH = path.join(process.cwd(), 'data', 'config.json');

// Default configuration
const DEFAULT_CONFIG: AppConfig = {
  apiUrl: 'https://api.deapi.ai/api/v1/client',
  apiToken: '',
  outputDir: './output',
  pollingIntervalMs: 2000,
  maxPollingAttempts: 120,
};

export function loadConfig(): AppConfig {
  try {
    // Start with defaults
    let config: AppConfig = { ...DEFAULT_CONFIG };

    // Load from config.json if exists
    if (fs.existsSync(CONFIG_PATH)) {
      const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const fileConfig = JSON.parse(content) as Partial<AppConfig>;
      config = { ...config, ...fileConfig };
    }

    // Environment variables take priority over config.json
    if (process.env.DEAPI_API_TOKEN) {
      config.apiToken = process.env.DEAPI_API_TOKEN;
    }
    if (process.env.DEAPI_API_URL) {
      config.apiUrl = process.env.DEAPI_API_URL;
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

    return config;
  } catch (error) {
    console.error('[deapi-tester] Error loading config:', error);
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: Partial<AppConfig>): AppConfig {
  try {
    const currentConfig = loadConfig();
    const newConfig: AppConfig = {
      ...currentConfig,
      ...config,
    };

    // Ensure data directory exists
    const dataDir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Write atomically: write to temp file, then rename
    const tempPath = CONFIG_PATH + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(newConfig, null, 2), 'utf-8');
    fs.renameSync(tempPath, CONFIG_PATH);

    return newConfig;
  } catch (error) {
    console.error('[deapi-tester] Error saving config:', error);
    throw error;
  }
}

export function getConfigValue<K extends keyof AppConfig>(key: K): AppConfig[K] {
  const config = loadConfig();
  return config[key];
}
